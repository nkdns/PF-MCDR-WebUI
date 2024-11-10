# PF-MCDR-WebUI
为 MCDR 开发的在线 WebUI 插件

[![页面浏览量计数](https://badges.toozhao.com/badges/01JC0ZMB6718E924N6H2FEZRC5/green.svg)](/) 
[![查看次数起始时间](https://img.shields.io/badge/查看次数统计起始于-2024%2F11%2F06-2?style=flat-square)](/)
[![仓库大小](https://img.shields.io/github/repo-size/LoosePrince/PF-MCDR-WebUI?style=flat-square&label=仓库占用)](/) 
[![最新版](https://img.shields.io/github/v/release/LoosePrince/PF-MCDR-WebUI?style=flat-square&label=最新版)](https://github.com/LoosePrince/PF-MCDR-WebUI/releases/latest/)
[![议题](https://img.shields.io/github/issues/LoosePrince/PF-MCDR-WebUI?style=flat-square&label=Issues)](https://github.com/LoosePrince/PF-MCDR-WebUI/issues) 
[![已关闭issues](https://img.shields.io/github/issues-closed/LoosePrince/PF-MCDR-WebUI?style=flat-square&label=已关闭%20Issues)](https://github.com/LoosePrince/PF-MCDR-WebUI/issues?q=is%3Aissue+is%3Aclosed)
[![下载量](https://img.shields.io/github/downloads/LoosePrince/PF-MCDR-WebUI/total?style=flat-square&label=下载量)](https://github.com/LoosePrince/PF-MCDR-WebUI/releases)
[![最新发布下载量](https://img.shields.io/github/downloads/LoosePrince/PF-MCDR-WebUI/latest/total?style=flat-square&label=最新版本下载量)](https://github.com/LoosePrince/PF-MCDR-WebUI/releases/latest)

## 插件说明

**主要功能：** 为MCDR提供一个在线WebUI管理界面（并不管理MC服务器，如有这方面的需求请查询MC服务器面板），和MCDR插件管理和表单配置功能（可选使用在线编辑器）。

**插件管理：** 提供列出全部插件、一键更新(推迟)、启动插件、停止插件、重载插件、插件配置修改（需要符合格式）。

**配置修改：** 使用在线表单 **或** 在线编辑器进行配置文件的修改（在所有插件出修改）。

**支持的配置：** `yaml` 格式或者 `json` 文件。
  - yml文件识别每项上一行注释作为中文标题，使用 `::` 分割，第二项为副标题，例 `标题::副标题` ，请注意，使用的是英文的符号；
  - json文件需要创建 `需要加标题的配置文件名_lang.josn` 例如 `abc_lang.json` 则会为 `abc.json` 创建中文标题，使用 `[标题,副标题]` 创建标题和副标题，参考示例 ：[config_lang.json](https://github.com/LoosePrince/PF-MCDR-WebUI/blob/main/config_lang.json)

**自定义：** 支持全局css和js配置文件，在首页提供在线编辑。

## 使用方式

**创建账户**

```bash
!!webui create <username> <password>
```

**更改密码**

```bash
!!webui change <username> <old password> <newpassword>
```

**临时密码**

```bash
!!webui temp
```

## 示例图

> 截图来源本地测试

![image](https://github.com/user-attachments/assets/b8556f19-25b1-433d-9691-72bb21816480)
![image](https://github.com/user-attachments/assets/5b868779-ec5c-4082-bf3e-f7564ba06e4b)
![image](https://github.com/user-attachments/assets/c1633bb7-de4d-4e5b-a091-ebae30322e19)
![image](https://github.com/user-attachments/assets/b1154e22-a111-4094-aab4-da3cefde7e14)
![image](https://github.com/user-attachments/assets/5b2ab04f-a4fb-4be5-b3a1-9da3a97709e3)
![image](https://github.com/user-attachments/assets/808c22e5-e3b4-46d7-8549-417c94438c16)
![image](https://github.com/user-attachments/assets/a50991e6-a281-4ec7-99e8-d8a921d15e95)
![image](https://github.com/user-attachments/assets/92ca8d19-40b1-444b-8aed-6c080c1b91a9)



## 开发进度

- 首页：90%
  - 主要功能：100%
  - 最近配置项：0%
- GUGUbot管理：90%
  - 配置：100%
  - 附加功能：0%
- cq-qq-api：80%
  - 配置：100%
  - 文档：0%
  - 附加功能：0%
- MC服务器配置：100%
- MCDR配置：100%
- 所有插件管理：90%
  - 管理：100%
  - 更新：100%
  - 配置修改：100%
  - 附加功能：0%
- 服务器终端：0%
- Fabric（部分）：0%

# 贡献

| 贡献人 | 说明 |
|---|---|
| [树梢 (LoosePrince)](https://github.com/LoosePrince) | 功能设计、文档编写、Web设计、前端编写 |
| [雪开 (XueK66)](https://github.com/XueK66) | 代码开发、维护、功能设计 |


| 贡献项目 | 说明 |
|---|---|
| [Ace Editor](https://ace.c9.io/) | 在线编辑器 |
| [MC-Server-Info](https://github.com/Spark-Code-China/MC-Server-Info) | Python Minecraft 服务器信息查询 |


| 特别鸣谢 |  |
|---|---|
| 反馈者 | 感谢你们的反馈 |
| [ChatGPT](https://chatgpt.com) | ChatGPT协助编写 |
