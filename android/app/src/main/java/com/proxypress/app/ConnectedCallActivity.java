package com.proxypress.app;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.res.ColorStateList;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.SurfaceView;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;

import com.bumptech.glide.Glide;

import io.agora.rtc2.Constants;
import io.agora.rtc2.IRtcEngineEventHandler;
import io.agora.rtc2.RtcEngine;
import io.agora.rtc2.RtcEngineConfig;
import io.agora.rtc2.video.VideoCanvas;

public class ConnectedCallActivity extends Activity {

    private static final String APP_ID = "14f09d846c4f46a2a51fde2c92e947d1";
    private static final String TAG = "ConnectedCall";

    private RtcEngine rtcEngine;
    private String channelName;
    private String callerId;
    private String callerName;
    private String avatarUrl;
    private String callType;

    private boolean isMuted = false;
    private boolean isSpeakerOn = false;
    private boolean isVideoOff = false;
    private int callDuration = 0;
    private Handler timerHandler;
    private Runnable timerRunnable;
    private boolean isCallEnded = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Window flags: keep screen on, show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );

        setContentView(R.layout.activity_connected_call);

        // Cancel the incoming call notification
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(101);

        // Extract call details from Intent
        channelName = getIntent().getStringExtra("channelName");
        callerId = getIntent().getStringExtra("callerId");
        callerName = getIntent().getStringExtra("callerName");
        avatarUrl = getIntent().getStringExtra("avatarUrl");
        callType = getIntent().getStringExtra("callType");

        if (callerName == null || callerName.isEmpty()) callerName = "Unknown";
        if (callType == null || callType.isEmpty()) callType = "voice";
        if (channelName == null || channelName.isEmpty()) {
            android.util.Log.e(TAG, "No channel name provided, cannot join call");
            finish();
            return;
        }

        // Set up the UI
        setupUI();
        setupControls();

        // Start the call duration timer
        TextView timerView = "video".equals(callType) 
            ? findViewById(R.id.tv_video_timer) 
            : findViewById(R.id.tv_call_timer);
        startCallTimer(timerView);

        // Initialize Agora and join channel
        initializeAgora();

        // Notify caller that call was accepted (for notification-triggered launches)
        if (getIntent().getBooleanExtra("notifyCaller", false)) {
            notifyCallAccepted();
        }
    }

    private void setupUI() {
        if ("video".equals(callType)) {
            // Video call: show video containers and header pill, hide voice content
            findViewById(R.id.remote_video_container).setVisibility(View.VISIBLE);
            findViewById(R.id.local_video_container).setVisibility(View.VISIBLE);
            findViewById(R.id.voice_call_content).setVisibility(View.GONE);
            findViewById(R.id.video_call_header).setVisibility(View.VISIBLE);
            findViewById(R.id.btn_video_toggle).setVisibility(View.VISIBLE);
            findViewById(R.id.btn_speaker).setVisibility(View.GONE);

            // Set video header info
            ((TextView) findViewById(R.id.tv_video_name)).setText(callerName);
            ((TextView) findViewById(R.id.tv_video_timer)).setText("0:00");
        } else {
            // Voice call: show avatar/name/timer center, hide video elements
            findViewById(R.id.remote_video_container).setVisibility(View.GONE);
            findViewById(R.id.local_video_container).setVisibility(View.GONE);
            findViewById(R.id.voice_call_content).setVisibility(View.VISIBLE);
            findViewById(R.id.video_call_header).setVisibility(View.GONE);
            findViewById(R.id.btn_video_toggle).setVisibility(View.GONE);
            findViewById(R.id.btn_speaker).setVisibility(View.VISIBLE);

            // Set voice call info
            ((TextView) findViewById(R.id.tv_connected_name)).setText(callerName);

            // Load avatar
            ImageView ivAvatar = findViewById(R.id.iv_connected_avatar);
            if (avatarUrl != null && !avatarUrl.isEmpty()) {
                Glide.with(this)
                     .load(avatarUrl)
                     .circleCrop()
                     .placeholder(android.R.drawable.sym_def_app_icon)
                     .error(android.R.drawable.sym_def_app_icon)
                     .into(ivAvatar);
            }
        }
    }

    private void setupControls() {
        findViewById(R.id.btn_mute).setOnClickListener(v -> toggleMute());
        findViewById(R.id.btn_end_call).setOnClickListener(v -> endCall());
        findViewById(R.id.btn_speaker).setOnClickListener(v -> toggleSpeaker());
        findViewById(R.id.btn_video_toggle).setOnClickListener(v -> toggleVideo());
    }

    // ========== Agora RTC ==========

    private void initializeAgora() {
        try {
            RtcEngineConfig config = new RtcEngineConfig();
            config.mContext = getApplicationContext();
            config.mAppId = APP_ID;
            config.mEventHandler = new IRtcEngineEventHandler() {
                @Override
                public void onJoinChannelSuccess(String channel, int uid, int elapsed) {
                    android.util.Log.d(TAG, "Joined Agora channel: " + channel + " uid: " + uid);
                }

                @Override
                public void onUserJoined(int uid, int elapsed) {
                    android.util.Log.d(TAG, "Remote user joined: " + uid);
                    if ("video".equals(callType)) {
                        runOnUiThread(() -> setupRemoteVideo(uid));
                    }
                }

                @Override
                public void onUserOffline(int uid, int reason) {
                    android.util.Log.d(TAG, "Remote user offline: " + uid + " reason: " + reason);
                    runOnUiThread(() -> endCall());
                }

                @Override
                public void onError(int err) {
                    android.util.Log.e(TAG, "Agora RTC error code: " + err);
                }
            };

            rtcEngine = RtcEngine.create(config);

            // Enable audio
            rtcEngine.enableAudio();

            if ("video".equals(callType)) {
                rtcEngine.enableVideo();
                setupLocalVideo();
            }

            // Join channel (no token, auto UID)
            int result = rtcEngine.joinChannel(null, channelName, "", 0);
            android.util.Log.d(TAG, "joinChannel result: " + result + " channel: " + channelName);

        } catch (Exception e) {
            android.util.Log.e(TAG, "Failed to initialize Agora RTC Engine", e);
        }
    }

    private void setupLocalVideo() {
        FrameLayout container = findViewById(R.id.local_video_container);
        container.removeAllViews();
        SurfaceView surfaceView = new SurfaceView(this);
        container.addView(surfaceView);
        rtcEngine.setupLocalVideo(new VideoCanvas(surfaceView, VideoCanvas.RENDER_MODE_HIDDEN, 0));
        rtcEngine.startPreview();
    }

    private void setupRemoteVideo(int uid) {
        FrameLayout container = findViewById(R.id.remote_video_container);
        container.removeAllViews();
        SurfaceView surfaceView = new SurfaceView(this);
        container.addView(surfaceView);
        rtcEngine.setupRemoteVideo(new VideoCanvas(surfaceView, VideoCanvas.RENDER_MODE_HIDDEN, uid));
    }

    // ========== Controls ==========

    private void toggleMute() {
        isMuted = !isMuted;
        if (rtcEngine != null) rtcEngine.muteLocalAudioStream(isMuted);

        ImageButton btn = findViewById(R.id.btn_mute);
        btn.setImageResource(isMuted ? R.drawable.ic_mic_off : R.drawable.ic_mic);
        btn.setBackgroundTintList(ColorStateList.valueOf(isMuted ? 0xFFFFFFFF : 0x1AFFFFFF));
        btn.setColorFilter(isMuted ? 0xFF000000 : 0xFFFFFFFF);
    }

    private void toggleSpeaker() {
        isSpeakerOn = !isSpeakerOn;
        if (rtcEngine != null) rtcEngine.setEnableSpeakerphone(isSpeakerOn);

        ImageButton btn = findViewById(R.id.btn_speaker);
        btn.setBackgroundTintList(ColorStateList.valueOf(isSpeakerOn ? 0xFFFFFFFF : 0x1AFFFFFF));
        btn.setColorFilter(isSpeakerOn ? 0xFF000000 : 0xFFFFFFFF);
    }

    private void toggleVideo() {
        isVideoOff = !isVideoOff;
        if (rtcEngine != null) rtcEngine.muteLocalVideoStream(isVideoOff);

        ImageButton btn = findViewById(R.id.btn_video_toggle);
        btn.setImageResource(isVideoOff ? R.drawable.ic_video_off : R.drawable.ic_video);
        btn.setBackgroundTintList(ColorStateList.valueOf(isVideoOff ? 0xFFFFFFFF : 0x1AFFFFFF));
        btn.setColorFilter(isVideoOff ? 0xFF000000 : 0xFFFFFFFF);
    }

    // ========== Call Lifecycle ==========

    private void endCall() {
        if (isCallEnded) return;
        isCallEnded = true;

        // Notify the other user
        notifyCallEnded();

        // Stop timer
        if (timerHandler != null && timerRunnable != null) {
            timerHandler.removeCallbacks(timerRunnable);
        }

        // Cancel notification
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(101);

        // Cleanup Agora
        cleanupAgora();

        finish();
    }

    private void cleanupAgora() {
        if (rtcEngine != null) {
            rtcEngine.leaveChannel();
            rtcEngine = null;
        }
        // Destroy the engine on a background thread to avoid blocking UI
        new Thread(() -> {
            try {
                RtcEngine.destroy();
            } catch (Exception e) {
                android.util.Log.e(TAG, "Error destroying RtcEngine", e);
            }
        }).start();
    }

    private void startCallTimer(TextView timerView) {
        timerHandler = new Handler(Looper.getMainLooper());
        timerRunnable = new Runnable() {
            @Override
            public void run() {
                callDuration++;
                int mins = callDuration / 60;
                int secs = callDuration % 60;
                String formatted = String.format("%d:%02d", mins, secs);
                timerView.setText(formatted);
                timerHandler.postDelayed(this, 1000);
            }
        };
        timerHandler.postDelayed(timerRunnable, 1000);
    }

    // ========== HTTP Notifications ==========

    private void notifyCallAccepted() {
        if (callerId == null || callerId.isEmpty()) return;
        new Thread(() -> {
            try {
                java.net.URL url = new java.net.URL("https://proxy-press-omega.vercel.app/api/messages/call");
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setDoOutput(true);
                String json = "{\"targetUserId\": \"" + callerId + "\", \"event\": \"call-accepted\"}";
                try (java.io.OutputStream os = conn.getOutputStream()) {
                    os.write(json.getBytes("utf-8"));
                }
                int code = conn.getResponseCode();
                android.util.Log.d(TAG, "Call accepted notification sent, response: " + code);
            } catch (Exception e) {
                android.util.Log.e(TAG, "Failed to send call accepted notification", e);
            }
        }).start();
    }

    private void notifyCallEnded() {
        if (callerId == null || callerId.isEmpty()) return;
        new Thread(() -> {
            try {
                java.net.URL url = new java.net.URL("https://proxy-press-omega.vercel.app/api/messages/call");
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setDoOutput(true);
                String json = "{\"targetUserId\": \"" + callerId + "\", \"event\": \"call-ended\"}";
                try (java.io.OutputStream os = conn.getOutputStream()) {
                    os.write(json.getBytes("utf-8"));
                }
                int code = conn.getResponseCode();
                android.util.Log.d(TAG, "Call ended notification sent, response: " + code);
            } catch (Exception e) {
                android.util.Log.e(TAG, "Failed to send call ended notification", e);
            }
        }).start();
    }

    // ========== Activity Lifecycle ==========

    @Override
    public void onBackPressed() {
        // Prevent accidental back press during active call
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (!isCallEnded) {
            notifyCallEnded();
        }
        if (timerHandler != null && timerRunnable != null) {
            timerHandler.removeCallbacks(timerRunnable);
        }
        cleanupAgora();
    }
}
