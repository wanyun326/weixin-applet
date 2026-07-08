package com.wanyun.voice.controller;

import com.wanyun.voice.service.AudioEffectEnum;
import com.wanyun.voice.service.VoiceProcessService;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * 变声控制器
 * 提供音频处理和音效查询接口
 *
 * @author wanyun
 */
@RestController
@RequestMapping("/api/voice")
public class VoiceController {

    private static final Logger log = LoggerFactory.getLogger(VoiceController.class);

    private final VoiceProcessService voiceProcessService;

    public VoiceController(VoiceProcessService voiceProcessService) {
        this.voiceProcessService = voiceProcessService;
    }

    /** 最大文件大小 (10MB) */
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    /**
     * 上传音频并进行变声处理
     *
     * @param file   音频文件
     * @param effect 音效类型（LOLI/DEEP/ROBOT/ALIEN/REVERB/ECHO/CHIPMUNK/DEMON）
     */
    @PostMapping("/process")
    public void processVoice(
            @RequestParam("file") MultipartFile file,
            @RequestParam("effect") String effect,
            HttpServletResponse response) {

        File outputFile = null;
        try {
            // 1. 参数校验
            validateFile(file);
            AudioEffectEnum effectEnum = AudioEffectEnum.fromKey(effect);

            log.info("收到变声请求: 文件名={}, 大小={}, 音效={}",
                    file.getOriginalFilename(), file.getSize(), effectEnum.getName());

            // 2. 调用服务处理音频
            outputFile = voiceProcessService.processVoice(file, effectEnum);

            // 3. 返回处理后的音频文件
            downloadFile(outputFile, response);

        } catch (IllegalArgumentException e) {
            log.warn("参数校验失败: {}", e.getMessage());
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            writeErrorResponse(response, e.getMessage());
        } catch (Exception e) {
            log.error("音频处理异常", e);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            writeErrorResponse(response, "音频处理失败: " + e.getMessage());
        } finally {
            // 4. 清理临时输出文件
            if (outputFile != null) {
                voiceProcessService.cleanupTempFile(outputFile);
            }
        }
    }

    /**
     * 获取所有可用音效列表
     */
    @GetMapping("/effects")
    public Map<String, Object> getEffects() {
        List<Map<String, String>> effects = new ArrayList<>();
        for (AudioEffectEnum effect : AudioEffectEnum.values()) {
            Map<String, String> map = new HashMap<>();
            map.put("key", effect.name());
            map.put("name", effect.getName());
            map.put("description", effect.getDescription());
            effects.add(map);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("code", 200);
        result.put("data", effects);
        return result;
    }

    /**
     * 健康检查接口
     */
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> result = new HashMap<>();
        result.put("code", 200);
        result.put("message", "voice-service is running");
        result.put("ffmpegAvailable", com.wanyun.voice.util.FFmpegUtil.isFFmpegAvailable());
        return result;
    }

    /**
     * 校验上传文件
     */
    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("音频文件不能为空");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("文件大小不能超过10MB");
        }
    }

    /**
     * 将文件写入响应（文件下载）
     */
    private void downloadFile(File file, HttpServletResponse response) throws IOException {
        String fileName = URLEncoder.encode("voice_processed.mp3", StandardCharsets.UTF_8);
        response.setContentType("audio/mpeg");
        response.setHeader("Content-Disposition", "attachment; filename=" + fileName);
        response.setContentLengthLong(file.length());

        try (FileInputStream fis = new FileInputStream(file);
             OutputStream os = response.getOutputStream()) {
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                os.write(buffer, 0, bytesRead);
            }
            os.flush();
        }
    }

    /**
     * 写入错误响应
     */
    private void writeErrorResponse(HttpServletResponse response, String message) {
        try {
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"code\":500,\"message\":\"" + message + "\"}");
        } catch (IOException e) {
            log.error("写入错误响应失败", e);
        }
    }
}
