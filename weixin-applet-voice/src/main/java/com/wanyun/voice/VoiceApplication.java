package com.wanyun.voice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * 变声核心服务启动类
 *
 * @author wanyun
 */
@SpringBootApplication
@EnableDiscoveryClient
public class VoiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(VoiceApplication.class, args);
        System.out.println("========================================");
        System.out.println("   Voice 变声服务启动成功! 端口: 8081");
        System.out.println("========================================");
    }
}
