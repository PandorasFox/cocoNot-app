package com.coconot.camera;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.YuvImage;
import android.util.Base64;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageProxy;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.LifecycleOwner;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import com.google.common.util.concurrent.ListenableFuture;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "Camera",
    permissions = {
        @Permission(strings = { android.Manifest.permission.CAMERA }, alias = "camera")
    }
)
public class CameraPlugin extends Plugin {

    private PreviewView previewView;
    private ProcessCameraProvider cameraProvider;
    private ImageAnalysis imageAnalysis;
    private ExecutorService analysisExecutor = Executors.newSingleThreadExecutor();
    private volatile PluginCall pendingCapture;

    @PluginMethod
    public void start(PluginCall call) {
        if (!hasRequiredPermissions()) {
            requestAllPermissions(call, "handleCameraPermission");
            return;
        }
        startCamera(call);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (cameraProvider != null) {
                    cameraProvider.unbindAll();
                    cameraProvider = null;
                }
                if (previewView != null) {
                    ViewGroup parent = (ViewGroup) previewView.getParent();
                    if (parent != null) parent.removeView(previewView);
                    previewView = null;
                }
            } catch (Exception ignored) {}
            call.resolve();
        });
    }

    @PluginMethod
    public void capture(PluginCall call) {
        if (imageAnalysis == null) {
            call.reject("Camera not started");
            return;
        }
        pendingCapture = call;
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (cameraProvider != null) cameraProvider.unbindAll();
        } catch (Exception ignored) {}
        analysisExecutor.shutdown();
        super.handleOnDestroy();
    }

    @androidx.annotation.Keep
    @PluginMethod
    public void handleCameraPermission(PluginCall call) {
        if (getPermissionState("camera").toString().equals("granted")) {
            startCamera(call);
        } else {
            call.reject("Camera permission denied");
        }
    }

    private void startCamera(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ListenableFuture<ProcessCameraProvider> future =
                ProcessCameraProvider.getInstance(getContext());

            future.addListener(() -> {
                try {
                    cameraProvider = future.get();

                    // Create preview view behind WebView
                    previewView = new PreviewView(getContext());
                    previewView.setLayoutParams(new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    ));
                    previewView.setImplementationMode(PreviewView.ImplementationMode.PERFORMANCE);

                    ViewGroup webViewParent = (ViewGroup) getBridge().getWebView().getParent();
                    webViewParent.addView(previewView, 0);

                    // Make WebView transparent
                    getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);

                    // Bind preview
                    Preview preview = new Preview.Builder().build();
                    preview.setSurfaceProvider(previewView.getSurfaceProvider());

                    // Bind image analysis for frame capture
                    imageAnalysis = new ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build();

                    imageAnalysis.setAnalyzer(analysisExecutor, image -> {
                        PluginCall capture = pendingCapture;
                        if (capture != null) {
                            pendingCapture = null;
                            try {
                                String base64 = imageProxyToBase64(image, capture.getInt("quality", 60));
                                JSObject result = new JSObject();
                                result.put("base64", base64);
                                capture.resolve(result);
                            } catch (Exception e) {
                                capture.reject("Frame capture failed: " + e.getMessage());
                            }
                        }
                        image.close();
                    });

                    cameraProvider.unbindAll();
                    cameraProvider.bindToLifecycle(
                        (LifecycleOwner) getActivity(),
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        imageAnalysis
                    );

                    call.resolve();
                } catch (Exception e) {
                    call.reject("Camera start failed: " + e.getMessage());
                }
            }, ContextCompat.getMainExecutor(getContext()));
        });
    }

    private String imageProxyToBase64(ImageProxy image, int quality) {
        // Convert YUV ImageProxy to JPEG base64
        ImageProxy.PlaneProxy[] planes = image.getPlanes();
        ByteBuffer yBuffer = planes[0].getBuffer();
        ByteBuffer uBuffer = planes[1].getBuffer();
        ByteBuffer vBuffer = planes[2].getBuffer();

        int ySize = yBuffer.remaining();
        int uSize = uBuffer.remaining();
        int vSize = vBuffer.remaining();

        // NV21 format: Y + VU interleaved
        byte[] nv21 = new byte[ySize + uSize + vSize];
        yBuffer.get(nv21, 0, ySize);
        vBuffer.get(nv21, ySize, vSize);
        uBuffer.get(nv21, ySize + vSize, uSize);

        int width = image.getWidth();
        int height = image.getHeight();

        YuvImage yuvImage = new YuvImage(nv21, ImageFormat.NV21, width, height, null);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        yuvImage.compressToJpeg(new Rect(0, 0, width, height), quality, out);

        // Handle rotation
        int rotation = image.getImageInfo().getRotationDegrees();
        byte[] jpegBytes = out.toByteArray();

        if (rotation != 0) {
            Bitmap bitmap = BitmapFactory.decodeByteArray(jpegBytes, 0, jpegBytes.length);
            Matrix matrix = new Matrix();
            matrix.postRotate(rotation);
            Bitmap rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
            ByteArrayOutputStream rotOut = new ByteArrayOutputStream();
            rotated.compress(Bitmap.CompressFormat.JPEG, quality, rotOut);
            jpegBytes = rotOut.toByteArray();
            bitmap.recycle();
            rotated.recycle();
        }

        return Base64.encodeToString(jpegBytes, Base64.NO_WRAP);
    }
}
