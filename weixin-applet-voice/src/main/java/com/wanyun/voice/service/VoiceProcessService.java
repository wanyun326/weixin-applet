package com.wanyun.voice.service;

import com.wanyun.voice.util.FFmpegUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.UUID;

/**
 * 变声处理服务
 * 负责音频文件的接收、FFmpeg处理、临时文件管理
 *
 * @author wanyun
 */
@Service
public class VoiceProcessService {

    private static final Logger log = LoggerFactory.getLogger(VoiceProcessService.class);

    /** 临时文件存储目录 */
    @Value("${voice.temp-dir:./temp/voice}")
    private String tempDir;

    /**
     * 处理音频文件，应用指定音效
     *
     * @param file   上传的音频文件
     * @param effect 音效类型
     * @return 处理后的音频文件
     * @throws IOException 文件操作异常
     */
    public File processVoice(MultipartFile file, AudioEffectEnum effect) throws IOException {
        // 1. 确保临时目录存在
        File tempDirFile = new File(tempDir);
        if (!tempDirFile.exists()) {
            tempDirFile.mkdirs();
        }

        // 2. 生成唯一文件名
        String fileId = UUID.randomUUID().toString().replace("-", "");
        String inputFileName = fileId + "_input" + getExtension(file.getOriginalFilename());
        String outputFileName = fileId + "_output.mp3";

        File inputFile = new File(tempDirFile, inputFileName);
        File outputFile = new File(tempDirFile, outputFileName);

        try {
            // 3. 保存上传的文件到临时目录
            file.transferTo(inputFile);
            log.info("音频文件已保存: {}, 大小: {} bytes", inputFile.getAbsolutePath(), file.getSize());

            // 4. 调用 FFmpeg 进行音效处理
            log.info("开始处理音频，音效: {} ({})", effect.getName(), effect.getFfmpegFilter());
            boolean success = FFmpegUtil.processAudio(
                    inputFile.getAbsolutePath(),
                    outputFile.getAbsolutePath(),
                    effect.getFfmpegFilter()
            );

            if (!success) {
                throw new RuntimeException("FFmpeg 音频处理失败");
            }

            log.info("音频处理完成: {}", outputFile.getAbsolutePath());
            return outputFile;

        } finally {
            // 5. 清理输入临时文件（输出文件由调用方清理）
            if (inputFile.exists() && !inputFile.delete()) {
                log.warn("清理输入临时文件失败: {}", inputFile.getAbsolutePath());
            }
        }
    }

    /**
     * 清理临时文件
     */
    public void cleanupTempFile(File file) {
        if (file != null && file.exists()) {
            if (file.delete()) {
                log.info("临时文件已清理: {}", file.getAbsolutePath());
            } else {
                log.warn("临时文件清理失败: {}", file.getAbsolutePath());
            }
        }
    }

    /**
     * 获取文件扩展名
     */
    private String getExtension(String fileName) {
        if (fileName == null) {
            return ".mp3";
        }
        int lastDot = fileName.lastIndexOf('.');
        return lastDot >= 0 ? fileName.substring(lastDot) : ".mp3";
    }
}
