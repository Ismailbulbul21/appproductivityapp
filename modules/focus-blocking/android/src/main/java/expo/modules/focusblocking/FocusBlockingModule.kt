package expo.modules.focusblocking

import android.app.AlarmManager
import android.app.AppOpsManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

class FocusBlockingModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("FocusBlocking")

        Function("hasPermissions") {
            val ctx = appContext.reactContext ?: return@Function false
            hasUsageAccess(ctx) && hasOverlayPermission(ctx)
        }

        Function("hasUsageAccess") {
            val ctx = appContext.reactContext ?: return@Function false
            hasUsageAccess(ctx)
        }

        Function("hasOverlayPermission") {
            val ctx = appContext.reactContext ?: return@Function false
            hasOverlayPermission(ctx)
        }

        AsyncFunction("requestUsageAccess") {
            val ctx = appContext.reactContext ?: return@AsyncFunction null
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            ctx.startActivity(intent)
            null
        }

        AsyncFunction("requestOverlayPermission") {
            val ctx = appContext.reactContext ?: return@AsyncFunction null
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${ctx.packageName}")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            ctx.startActivity(intent)
            null
        }

        AsyncFunction("getInstalledApps") {
            val ctx = appContext.reactContext
                ?: return@AsyncFunction emptyList<Map<String, String>>()
            val pm = ctx.packageManager
            val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val resolveInfos = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.queryIntentActivities(
                    mainIntent, PackageManager.ResolveInfoFlags.of(0)
                )
            } else {
                @Suppress("DEPRECATION")
                pm.queryIntentActivities(mainIntent, 0)
            }
            resolveInfos
                .filter { it.activityInfo.packageName != ctx.packageName }
                .map { info ->
                    val icon = try {
                        drawableToBase64(info.loadIcon(pm))
                    } catch (_: Exception) { "" }
                    mapOf(
                        "packageName" to info.activityInfo.packageName,
                        "label" to info.loadLabel(pm).toString(),
                        "icon" to icon
                    )
                }
                .distinctBy { it["packageName"] }
                .sortedBy { it["label"]?.lowercase() }
        }

        AsyncFunction("startBlocking") { blockedPackages: List<String>, endTimeMs: Double? ->
            val ctx = appContext.reactContext ?: return@AsyncFunction false
            val intent = Intent(ctx, FocusBlockingService::class.java).apply {
                putStringArrayListExtra(
                    FocusBlockingService.EXTRA_BLOCKED_PACKAGES,
                    ArrayList(blockedPackages)
                )
                if (endTimeMs != null) {
                    putExtra(FocusBlockingService.EXTRA_END_TIME_MS, endTimeMs.toLong())
                }
            }
            ContextCompat.startForegroundService(ctx, intent)
            true
        }

        AsyncFunction("stopBlocking") {
            val ctx = appContext.reactContext ?: return@AsyncFunction false
            ctx.getSharedPreferences("focus_blocking_prefs", Context.MODE_PRIVATE).edit()
                .remove("blocked_packages_set")
                .putBoolean("session_active", false)
                .apply()
            ctx.stopService(Intent(ctx, FocusBlockingService::class.java))
            FocusBlockingService.isRunning = false
            true
        }

        AsyncFunction("scheduleBlocking") { blockedPackages: List<String>, startTimeMs: Double, endTimeMs: Double, uniqueId: String ->
            val ctx = appContext.reactContext ?: return@AsyncFunction false
            val alarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            
            val intent = Intent(ctx, FocusBlockingReceiver::class.java).apply {
                action = FocusBlockingReceiver.ACTION_START_BLOCKING
                putStringArrayListExtra(FocusBlockingReceiver.EXTRA_BLOCKED_PACKAGES, ArrayList(blockedPackages))
                putExtra(FocusBlockingReceiver.EXTRA_END_TIME_MS, endTimeMs.toLong())
            }

            val pendingIntent = PendingIntent.getBroadcast(
                ctx,
                uniqueId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                val settingsIntent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                ctx.startActivity(settingsIntent)
                return@AsyncFunction false
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    startTimeMs.toLong(),
                    pendingIntent
                )
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    startTimeMs.toLong(),
                    pendingIntent
                )
            }
            true
        }

        AsyncFunction("cancelScheduledBlocking") { uniqueId: String ->
            val ctx = appContext.reactContext ?: return@AsyncFunction false
            val alarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(ctx, FocusBlockingReceiver::class.java).apply {
                action = FocusBlockingReceiver.ACTION_START_BLOCKING
            }

            val pendingIntent = PendingIntent.getBroadcast(
                ctx,
                uniqueId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
            true
        }

        Function("isBlocking") {
            FocusBlockingService.isRunning
        }
    }

    private fun hasUsageAccess(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                context.packageName
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun hasOverlayPermission(context: Context): Boolean {
        return Settings.canDrawOverlays(context)
    }

    private fun drawableToBase64(drawable: Drawable): String {
        val bitmap = if (drawable is BitmapDrawable && drawable.bitmap != null) {
            drawable.bitmap
        } else {
            val w = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 96
            val h = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 96
            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            bmp
        }
        val scaled = Bitmap.createScaledBitmap(bitmap, 96, 96, true)
        val stream = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.PNG, 80, stream)
        return Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
    }
}
