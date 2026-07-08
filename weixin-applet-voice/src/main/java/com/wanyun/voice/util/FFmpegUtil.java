package com.wanyun.voice.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * FFmpeg 工具类
 * 封装 FFmpeg 命令行调用，实现音频处理功能
 *
 * @author wanyun
 */
public class FFmpegUtil {

    private static final Logger log = LoggerFactory.getLogger(FFmpegUtil.class);

    /** FFmpeg 命令路径（默认从 PATH 中查找） */
    private static final String FFMPEG_CMD = "ffmpeg";

    /** 默认超时时间（秒） */
    private static final int TIMEOUT_SECONDS = 30;

    private FFmpegUtil() {
        // 工具类，禁止实例化
    }

    /**
     * 执行 FFmpeg 音频处理
     *
     * @param inputPath  输入音频文件路径
     * @param outputPath 输出音频文件路径
     * @param filter     FFmpeg 音频滤镜参数
     * @return 是否执行成功
     */
    public static boolean processAudio(String inputPath, String outputPath, String filter) {
        // 检查输入文件是否存在
        File inputFile = new File(inputPath);
        if (!inputFile.exists()) {
            log.error("输入文件不存在: {}", inputPath);
            return false;
        }

        // 构建 FFmpeg 命令
        List<String> command = buildCommand(inputPath, outputPath, filter);
        log.info("执行 FFmpeg 命令: {}", String.join(" ", command));

        try {
            // 启动 FFmpeg 进程
            ProcessBuilder processBuilder = new ProcessBuilder(command);
            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();

            // 读取输出流（避免缓冲区满导致进程挂起）
            StreamGobbler outputGobbler = new StreamGobbler(process.getInputStream());
            outputGobbler.start();

            // 等待进程完成
            boolean finished = process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                log.error("FFmpeg 处理超时，强制终止");
                process.destroyForcibly();
                return false;
            }

            int exitCode = process.exitValue();
            if (exitCode == 0) {
                log.info("FFmpeg 处理成功，输出文件: {}", outputPath);
                return true;
            } else {
                log.error("FFmpeg 处理失败，退出码: {}, 输出: {}", exitCode, outputGobbler.getOutput());
                return false;
            }
        } catch (IOException | InterruptedException e) {
            log.error("FFmpeg 执行异常", e);
            Thread.currentThread().interrupt();
            return false;
        }
    }

    /**
     * 构建 FFmpeg 命令列表
     */
    private static List<String> buildCommand(String inputPath, String outputPath, String filter) {
        List<String> command = new ArrayList<>();
        command.add(FFMPEG_CMD);
        command.add("-y");                    // 覆盖输出文件
        command.add("-i");                    // 输入文件
        command.add(inputPath);
        command.add("-af");                   // 音频滤镜
        command.add(filter);
        command.add("-acodec");               // 音频编码器
        command.add("libmp3lame");
        command.add("-ar");                   // 采样率
        command.add("16000");
        command.add("-ac");                   // 声道数
        command.add("1");
        command.add("-b:a");                  // 比特率
        command.add("128k");
        command.add(outputPath);
        return command;
    }

    /**
     * 检查 FFmpeg 是否可用
     */
    public static boolean isFFmpegAvailable() {
        try {
            Process process = new ProcessBuilder(FFMPEG_CMD, "-version").start();
            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            return finished && process.exitValue() == 0;
        } catch (IOException | InterruptedException e) {
            log.warn("FFmpeg 不可用: {}", e.getMessage());
            Thread.currentThread().interrupt();
            return false;
        }
    }

    /**
     * 流读取线程（消费进程输出，防止缓冲区满）
     */
    private static class StreamGobbler extends Thread {
        private final java.io.InputStream inputStream;
        private final StringBuilder output = new StringBuilder();

        StreamGobbler(java.io.InputStream inputStream) {
            this.inputStream = inputStream;
        }

        @Override
        public void run() {
            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(inputStream))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            } catch (IOException e) {
                // ignore
            }
        }

        String getOutput() {
            return output.toString();
        }
    }
}
