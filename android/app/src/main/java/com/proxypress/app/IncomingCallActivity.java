package com.proxypress.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.TextView;
import com.bumptech.glide.Glide;

public class IncomingCallActivity extends Activity {
    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private String channelName;
    private String callerId;
    private String callerName;
    private String avatarUrl;
    private String callType;

    private final android.content.BroadcastReceiver stopRingingReceiver = new android.content.BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("ACTION_STOP_RINGING".equals(intent.getAction())) {
                stopRingtoneAndVibrator();
                finish();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. Configure Window flags to show above Keyguard & Lockscreen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                                 WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                                 WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                                 WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }

        setContentView(R.layout.activity_incoming_call);

        // Register stop ringing receiver to end activity if caller hangs up
        registerReceiver(stopRingingReceiver, new android.content.IntentFilter("ACTION_STOP_RINGING"));

        // 2. Extract call details from the launching Intent
        Intent intent = getIntent();
        callerId = intent.getStringExtra("callerId");
        callerName = intent.getStringExtra("callerName");
        avatarUrl = intent.getStringExtra("avatarUrl");
        channelName = intent.getStringExtra("channelName");
        callType = intent.getStringExtra("callType");

        if (callerName == null) callerName = "Incoming Call";
        if (callType == null) callType = "voice";

        // Bind layout views
        TextView tvCallerName = findViewById(R.id.tv_caller_name);
        TextView tvCallType = findViewById(R.id.tv_call_type);
        ImageView ivAvatar = findViewById(R.id.iv_caller_avatar);

        tvCallerName.setText(callerName);
        tvCallType.setText(callType.toUpperCase() + " CALL");

        // Load circular avatar with Glide
        if (avatarUrl != null && !avatarUrl.isEmpty()) {
            Glide.with(this)
                 .load(avatarUrl)
                 .circleCrop()
                 .placeholder(android.R.drawable.sym_def_app_icon)
                 .error(android.R.drawable.sym_def_app_icon)
                 .into(ivAvatar);
        }

        // 3. Play Looping System Call Ringtone
        try {
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (ringtoneUri == null) {
                ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, ringtoneUri);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );
            } else {
                mediaPlayer.setAudioStreamType(android.media.AudioManager.STREAM_RING);
            }
            
            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 4. Start Vibrator Pattern
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 1000, 800, 1000};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 5. Connect Accept/Decline Click Listeners
        findViewById(R.id.btn_accept).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopRingtoneAndVibrator();

                // Start MainActivity passing call accepted action
                Intent mainIntent = new Intent(IncomingCallActivity.this, MainActivity.class);
                mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                mainIntent.putExtra("acceptCall", true);
                mainIntent.putExtra("channelName", channelName);
                mainIntent.putExtra("callerId", callerId);
                mainIntent.putExtra("callerName", callerName);
                mainIntent.putExtra("callType", callType);
                startActivity(mainIntent);

                finish();
            }
        });

        findViewById(R.id.btn_decline).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopRingtoneAndVibrator();
                notifyCallerDecline(callerId);
                finish();
            }
        });
    }

    private void notifyCallerDecline(final String callerId) {
        if (callerId == null || callerId.isEmpty()) return;
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    java.net.URL url = new java.net.URL("https://proxy-press-omega.vercel.app/api/messages/call");
                    java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json; utf-8");
                    conn.setRequestProperty("Accept", "application/json");
                    conn.setDoOutput(true);

                    String jsonInputString = "{\"targetUserId\": \"" + callerId + "\", \"event\": \"call-rejected\"}";

                    try (java.io.OutputStream os = conn.getOutputStream()) {
                        byte[] input = jsonInputString.getBytes("utf-8");
                        os.write(input, 0, input.length);
                    }

                    int code = conn.getResponseCode();
                    android.util.Log.d("IncomingCallActivity", "Decline call notification response code: " + code);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }).start();
    }

    private void stopRingtoneAndVibrator() {
        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
                mediaPlayer = null;
            }
            if (vibrator != null) {
                vibrator.cancel();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void onUserLeaveHint() {
        // Stop sounds if user hits Home key to hide dialer
        super.onUserLeaveHint();
        stopRingtoneAndVibrator();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopRingtoneAndVibrator();
        try {
            unregisterReceiver(stopRingingReceiver);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
