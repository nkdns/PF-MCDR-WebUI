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

## 说明

**主要功能：** 为MCDR提供一个在线WebUI管理界面（并不管理MC服务器，如有这方面的需求请查询MC服务器面板），和MCDR插件管理和表单配置功能（可选使用在线编辑器）。

**插件管理：** 提供列出全部插件、一键更新、启动插件、停止插件、重载插件、插件配置修改（需要符合格式）。

**配置修改：** 使用在线表单 **或** 在线编辑器进行配置文件的修改（在所有插件出修改）。

**支持的配置：** `yaml` 格式或者 `json` 文件。
  - yml文件识别每项上一行注释作为中文标题，使用 `::` 分割，第二项为副标题，例 `标题::副标题` ，请注意，使用的是英文的符号；
  - json文件需要创建 `需要加标题的配置文件名_note.josn` 例如 `abc_note.json` 则会为 `abc.json` 创建中文标题，使用 `[标题,副标题]` 创建标题和副标题，参考示例 ：[config_note.json](https://github.com/LoosePrince/PF-MCDR-WebUI/blob/main/config_note.json)

**自定义：** 支持全局css和js配置文件，在首页提供在线编辑。

## 示例图

> 第1张和第7张为内测用户提供

![image](https://github.com/user-attachments/assets/fdcf5cf2-549a-4b83-a260-e9c54690734b)
![image](https://github.com/user-attachments/assets/06ee0b63-7463-4a3e-a940-d01e2a4f649b)
![image](https://github.com/user-attachments/assets/e09fd9ab-d04e-44ca-a06f-fa80fb085804)
![image](https://github.com/user-attachments/assets/c8ea77cf-7022-4fdc-b72a-3c8189d69f7a)
![image](https://github.com/user-attachments/assets/a4bd1b41-bbff-473b-bfe7-c3d0ebf18d82)
![image](https://github.com/user-attachments/assets/22558ae4-21b2-46a9-b309-7900e85e2eca)
![image](https://github.com/user-attachments/assets/038753a0-8814-4a04-bd6b-e266540f6bf7)


## 开发进度

- 首页：90%
- GUGUbot管理：50%
  - 配置：100%
  - 附加功能：0%
- cq-qq-api：50
  - 配置：100%
  - 附加功能：0%
- MC服务器配置：0%
- MCDR配置：0%
- 所有插件管理：90%
  - 管理：100%
  - 更新：100%
  - 配置修改：100%
  - 附加功能：0%
- Fabric（部分）：0%

# 贡献

| 贡献人 | 说明 |
|---|---|
| [树梢 (LoosePrince)](https://github.com/LoosePrince) | 功能设计、文档编写、Web设计、前端编写 |
| [雪开 (XueK66)](https://github.com/XueK66) | 代码开发、维护、功能设计 |


| 贡献项目 | 说明 |
|---|---|
| [Ace Editor](https://ace.c9.io/) | 在线编辑器 |


| 特别鸣谢 |  |
|---|---|
| 反馈者 | 感谢你们的反馈 |
| [ChatGPT](https://chatgpt.com) | ChatGPT协助编写 |
