package expo.modules.focusblocking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

class FocusBlockingReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_START_BLOCKING = "expo.modules.focusblocking.START_BLOCKING"
        const val EXTRA_BLOCKED_PACKAGES = "blocked_packages"
        const val EXTRA_END_TIME_MS = "end_time_ms"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_START_BLOCKING) {
            val packages = intent.getStringArrayListExtra(EXTRA_BLOCKED_PACKAGES)
            val endTimeMs = intent.getLongExtra(EXTRA_END_TIME_MS, 0L)

            if (packages != null && packages.isNotEmpty()) {
                val serviceIntent = Intent(context, FocusBlockingService::class.java).apply {
                    putStringArrayListExtra(FocusBlockingService.EXTRA_BLOCKED_PACKAGES, packages)
                    putExtra(FocusBlockingService.EXTRA_END_TIME_MS, endTimeMs)
                }
                
                // Start the foreground service natively, bypassing React Native completely
                ContextCompat.startForegroundService(context, serviceIntent)
            }
        }
    }
}
