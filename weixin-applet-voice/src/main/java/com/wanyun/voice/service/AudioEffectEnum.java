package com.wanyun.voice.service;

/**
 * 音效类型枚举
 *
 * @author wanyun
 */
public enum AudioEffectEnum {

    LOLI("萝莉音", "可爱萝莉音效，音调提高",
            "-af asetrate=32000,atempo=0.7,aresample=16000"),

    DEEP("大叔音", "低沉大叔音效，音调降低",
            "-af asetrate=10000,atempo=1.5,aresample=16000"),

    ROBOT("机器人", "机械机器人音效，回声+镶边",
            "-af aecho=0.8:0.5:40:0.3,flanger"),

    ALIEN("外星人", "神秘外星人音效，变采样率+颤音",
            "-af asetrate=18000,vibrato=f=8:d=0.5,aresample=16000"),

    REVERB("混响", "KTV混响效果",
            "-af aecho=0.8:0.7:60:0.5"),

    ECHO("回声", "山谷回声效果",
            "-af aecho=0.8:0.8:100:0.3|0.8:0.8:200:0.2"),

    CHIPMUNK("花栗鼠", "超级高音，像花栗鼠一样",
            "-af asetrate=40000,atempo=0.5,aresample=16000"),

    DEMON("恶魔", "低沉恶魔音效",
            "-af asetrate=8000,atempo=1.8,aresample=16000,aecho=0.6:0.5:50:0.4");

    /** 音效名称 */
    private final String name;

    /** 音效描述 */
    private final String description;

    /** FFmpeg 音频滤镜参数 */
    private final String ffmpegFilter;

    AudioEffectEnum(String name, String description, String ffmpegFilter) {
        this.name = name;
        this.description = description;
        this.ffmpegFilter = ffmpegFilter;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getFfmpegFilter() {
        return ffmpegFilter;
    }

    /**
     * 根据 key 获取音效枚举
     */
    public static AudioEffectEnum fromKey(String key) {
        try {
            return valueOf(key.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("不支持的音效类型: " + key);
        }
    }
}
