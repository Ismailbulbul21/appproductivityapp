package expo.modules.focusblocking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class FocusBlockingService : Service() {

    private var blockedPackages = listOf<String>()
    private var endTimeMs: Long = 0L
    private var overlayView: View? = null
    private var windowManager: WindowManager? = null
    private val handler = Handler(Looper.getMainLooper())
    private var checkRunnable: Runnable? = null
    private var safeConsecutiveCount = 0
    private var launcherPackage: String? = null

    companion object {
        const val CHANNEL_ID = "xasuus_focus"
        const val NOTIFICATION_ID = 9001
        const val EXTRA_BLOCKED_PACKAGES = "blocked_packages"
        const val EXTRA_END_TIME_MS = "end_time_ms"
        const val CHECK_INTERVAL = 1000L
        const val SAFE_COUNT_THRESHOLD = 3
        private const val PREFS_NAME = "focus_blocking_prefs"
        private const val PREFS_BLOCKED_PACKAGES = "blocked_packages_set"
        private const val PREFS_END_TIME_MS = "end_time_ms"
        private const val PREFS_SESSION_ACTIVE = "session_active"
        @Volatile var isRunning = false
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        launcherPackage = getDefaultLauncherPackage()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val packagesFromIntent = intent?.getStringArrayListExtra(EXTRA_BLOCKED_PACKAGES)
        val endMsFromIntent = intent?.getLongExtra(EXTRA_END_TIME_MS, 0L) ?: 0L

        if (packagesFromIntent != null && packagesFromIntent.isNotEmpty()) {
            blockedPackages = packagesFromIntent
            endTimeMs = endMsFromIntent
            saveBlockedPackages(packagesFromIntent, endTimeMs)
        } else {
            val loaded = loadBlockedPackages()
            blockedPackages = loaded.first
            endTimeMs = loaded.second
        }

        if (blockedPackages.isEmpty()) {
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIFICATION_ID, buildNotification())
        isRunning = true
        startMonitoring()
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (blockedPackages.isNotEmpty()) {
            val restartIntent = Intent(applicationContext, FocusBlockingService::class.java)
            restartIntent.putStringArrayListExtra(EXTRA_BLOCKED_PACKAGES, ArrayList(blockedPackages))
            restartIntent.putExtra(EXTRA_END_TIME_MS, endTimeMs)
            ContextCompat.startForegroundService(applicationContext, restartIntent)
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        stopMonitoring()
        removeOverlay()
        isRunning = false
        super.onDestroy()
    }

    private fun saveBlockedPackages(packages: List<String>, endMs: Long) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putStringSet(PREFS_BLOCKED_PACKAGES, packages.toSet())
            .putLong(PREFS_END_TIME_MS, endMs)
            .putBoolean(PREFS_SESSION_ACTIVE, true)
            .apply()
    }

    private fun loadBlockedPackages(): Pair<List<String>, Long> {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(PREFS_SESSION_ACTIVE, false)) return Pair(emptyList(), 0L)
        val pkgs = prefs.getStringSet(PREFS_BLOCKED_PACKAGES, emptySet())?.toList() ?: emptyList()
        val endMs = prefs.getLong(PREFS_END_TIME_MS, 0L)
        return Pair(pkgs, endMs)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID, "Focus Mode", NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Focus session waa socda"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Focus waa firfircoon")
            .setContentText("Apps-ka la xirey ma furan karaan")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()

    // ── Foreground app monitoring ────────────────────────────────

    private fun startMonitoring() {
        checkRunnable = object : Runnable {
            override fun run() {
                val now = System.currentTimeMillis()
                if (endTimeMs > 0 && now >= endTimeMs) {
                    removeOverlay()
                    stopSelf()
                    isRunning = false
                    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putBoolean(PREFS_SESSION_ACTIVE, false).apply()
                    return
                }

                val fg = currentForegroundPackage()
                val isBlocked = fg != null && blockedPackages.contains(fg) && fg != packageName
                val isSafe = fg == packageName || fg == launcherPackage

                if (isBlocked) {
                    safeConsecutiveCount = 0
                    showOverlay()
                } else if (overlayView != null) {
                    if (isSafe) {
                        safeConsecutiveCount++
                        if (safeConsecutiveCount >= SAFE_COUNT_THRESHOLD) {
                            removeOverlay()
                            safeConsecutiveCount = 0
                        }
                    } else {
                        safeConsecutiveCount = 0
                    }
                } else {
                    safeConsecutiveCount = 0
                }

                handler.postDelayed(this, CHECK_INTERVAL)
            }
        }
        handler.post(checkRunnable!!)
    }

    private fun stopMonitoring() {
        checkRunnable?.let { handler.removeCallbacks(it) }
        checkRunnable = null
    }

    private fun currentForegroundPackage(): String? {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE)
            as? UsageStatsManager ?: return null
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(now - 10000, now)
        var lastPkg: String? = null
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                lastPkg = event.packageName
            }
        }
        return lastPkg
    }

    private fun getDefaultLauncherPackage(): String? {
        val intent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
        }
        val resolveInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.resolveActivity(
                intent, PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong())
            )
        } else {
            @Suppress("DEPRECATION")
            packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
        }
        return resolveInfo?.activityInfo?.packageName
    }

    // ── Full-screen overlay ──────────────────────────────────────

    private fun showOverlay() {
        if (overlayView != null) return
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )
        overlayView = buildOverlayUI()
        try {
            windowManager?.addView(overlayView, params)
        } catch (_: Exception) {
            overlayView = null
        }
    }

    private fun removeOverlay() {
        overlayView?.let {
            try { windowManager?.removeView(it) } catch (_: Exception) {}
            overlayView = null
        }
    }

    private fun dp(v: Int): Int =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics
        ).toInt()

    private fun buildOverlayUI(): View {
        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#F8FAFC"))
        }
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(40), dp(80), dp(40), dp(80))
        }

        // Lock icon circle
        val iconBg = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(96), dp(96)).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                bottomMargin = dp(28)
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#FEE2E2"))
            }
        }
        iconBg.addView(TextView(this).apply {
            text = "\uD83D\uDD12"
            textSize = 36f
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        })
        col.addView(iconBg)

        col.addView(TextView(this).apply {
            text = "Focus session waa socda"
            setTextColor(Color.parseColor("#111827"))
            textSize = 26f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(16) }
        })

        col.addView(TextView(this).apply {
            text = "App-kan waa la xirey.\nKa noqo Xasuus ama sug inta timer uu dhammaado."
            setTextColor(Color.parseColor("#6B7280"))
            textSize = 16f
            gravity = Gravity.CENTER
            setLineSpacing(dp(4).toFloat(), 1f)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(40) }
        })

        col.addView(TextView(this).apply {
            text = "Ka noqo app-ka"
            setTextColor(Color.WHITE)
            textSize = 17f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(18), dp(24), dp(18))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#059669"))
                cornerRadius = dp(20).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setOnClickListener {
                removeOverlay()
                val launch = packageManager.getLaunchIntentForPackage(packageName)
                launch?.let {
                    it.addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    )
                    startActivity(it)
                }
            }
        })

        root.addView(
            col,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
        return root
    }
}
