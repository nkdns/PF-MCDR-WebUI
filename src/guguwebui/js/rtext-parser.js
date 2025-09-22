/**
 * RText (Raw JSON Text) 解析器
 * 支持Minecraft的文本组件格式，包括颜色、样式、点击事件、悬停事件等
 * 
 * 基于Minecraft Wiki: https://zh.minecraft.wiki/w/文本组件
 */

class RTextParser {
    constructor() {
        // Minecraft颜色映射
        this.colors = {
            'black': '#000000',
            'dark_blue': '#0000AA',
            'dark_green': '#00AA00',
            'dark_aqua': '#00AAAA',
            'dark_red': '#AA0000',
            'dark_purple': '#AA00AA',
            'gold': '#FFAA00',
            'gray': '#AAAAAA',
            'dark_gray': '#555555',
            'blue': '#5555FF',
            'green': '#55FF55',
            'aqua': '#55FFFF',
            'red': '#FF5555',
            'light_purple': '#FF55FF',
            'yellow': '#FFFF55',
            'white': '#FFFFFF'
        };

        // 样式映射
        this.styles = {
            'bold': 'font-weight: bold',
            'italic': 'font-style: italic',
            'underlined': 'text-decoration: underline',
            'strikethrough': 'text-decoration: line-through',
            'obfuscated': 'font-family: monospace' // 混淆文本使用等宽字体
        };

        // 点击事件类型
        this.clickActions = {
            'open_url': 'openUrl',
            'run_command': 'runCommand',
            'suggest_command': 'suggestCommand',
            'change_page': 'changePage',
            'copy_to_clipboard': 'copyToClipboard'
        };
    }

    /**
     * 解析RText组件
     * @param {string|object|array} rtext - RText数据（字符串、对象或数组）
     * @returns {string} - 渲染后的HTML
     */
    parse(rtext) {
        if (!rtext) return '';

        try {
            // 如果是字符串，直接返回
            if (typeof rtext === 'string') {
                return this.escapeHtml(rtext);
            }

            // 如果是数组，递归解析每个元素
            if (Array.isArray(rtext)) {
                return rtext.map(item => this.parse(item)).join('');
            }

            // 如果是对象，解析为复合标签格式
            if (typeof rtext === 'object') {
                return this.parseComponent(rtext);
            }

            return this.escapeHtml(String(rtext));
        } catch (error) {
            console.error('RText解析错误:', error);
            return this.escapeHtml(String(rtext));
        }
    }

    /**
     * 解析单个组件
     * @param {object} component - 组件对象
     * @returns {string} - 渲染后的HTML
     */
    parseComponent(component) {
        let html = '';
        let styles = [];
        let classes = [];
        let attributes = {};
        let clickHandler = null;
        let hoverHandler = null;

        // 处理文本内容
        let text = '';
        if (component.text !== undefined) {
            text = component.text;
        } else if (component.translate !== undefined) {
            // 处理本地化文本
            text = this.handleTranslate(component);
        } else if (component.keybind !== undefined) {
            // 处理键位绑定
            text = `[${component.keybind}]`;
        } else if (component.score !== undefined) {
            // 处理记分板数据
            text = this.handleScore(component);
        } else if (component.selector !== undefined) {
            // 处理实体选择器
            text = this.handleSelector(component);
        } else if (component.nbt !== undefined) {
            // 处理NBT数据
            text = this.handleNBT(component);
        }

        // 处理颜色
        if (component.color) {
            const color = this.parseColor(component.color);
            if (color) {
                styles.push(`color: ${color}`);
            }
        }

        // 处理字体
        if (component.font) {
            styles.push(`font-family: ${component.font}`);
        }

        // 处理样式
        if (component.bold) styles.push(this.styles.bold);
        if (component.italic) styles.push(this.styles.italic);
        if (component.underlined) styles.push(this.styles.underlined);
        if (component.strikethrough) styles.push(this.styles.strikethrough);
        if (component.obfuscated) {
            styles.push(this.styles.obfuscated);
            classes.push('rtext-obfuscated');
        }

        // 处理插入
        if (component.insertion) {
            attributes['data-insertion'] = component.insertion;
        }

        // 处理点击事件
        if (component.clickEvent) {
            clickHandler = this.handleClickEvent(component.clickEvent);
        }

        // 处理悬停事件
        if (component.hoverEvent) {
            hoverHandler = this.handleHoverEvent(component.hoverEvent);
        }

        // 构建HTML标签
        let tagName = 'span';
        if (styles.length > 0 || classes.length > 0 || Object.keys(attributes).length > 0 || clickHandler || hoverHandler) {
            let styleAttr = styles.length > 0 ? `style="${styles.join('; ')}"` : '';
            let classAttr = classes.length > 0 ? `class="${classes.join(' ')}"` : '';
            let attrStr = Object.entries(attributes).map(([key, value]) => `${key}="${this.escapeHtml(value)}"`).join(' ');
            
            html += `<${tagName} ${classAttr} ${styleAttr} ${attrStr}`;
            
            if (clickHandler) {
                html += ` onclick="${clickHandler.onclick}"`;
            }
            
            if (hoverHandler) {
                html += ` title="${this.escapeHtml(hoverHandler.title)}"`;
            }
            
            html += '>';
        }

        // 添加文本内容
        html += this.escapeHtml(text);

        // 处理子组件
        if (component.extra && Array.isArray(component.extra)) {
            html += component.extra.map(child => this.parse(child)).join('');
        }

        // 闭合标签
        if (styles.length > 0 || classes.length > 0 || Object.keys(attributes).length > 0 || clickHandler || hoverHandler) {
            html += `</${tagName}>`;
        }

        return html;
    }

    /**
     * 解析颜色
     * @param {string} color - 颜色名称或十六进制值
     * @returns {string} - 十六进制颜色值
     */
    parseColor(color) {
        if (color.startsWith('#')) {
            return color;
        }
        return this.colors[color] || color;
    }

    /**
     * 处理本地化文本
     * @param {object} component - 包含translate的组件
     * @returns {string} - 处理后的文本
     */
    handleTranslate(component) {
        // 简化处理，直接返回translate键
        return `[${component.translate}]`;
    }

    /**
     * 处理记分板数据
     * @param {object} component - 包含score的组件
     * @returns {string} - 处理后的文本
     */
    handleScore(component) {
        const score = component.score;
        return `${score.name || 'Unknown'}: ${score.value || 0}`;
    }

    /**
     * 处理实体选择器
     * @param {object} component - 包含selector的组件
     * @returns {string} - 处理后的文本
     */
    handleSelector(component) {
        return `[@${component.selector}]`;
    }

    /**
     * 处理NBT数据
     * @param {object} component - 包含nbt的组件
     * @returns {string} - 处理后的文本
     */
    handleNBT(component) {
        return `[NBT: ${component.nbt}]`;
    }

    /**
     * 处理点击事件
     * @param {object} clickEvent - 点击事件对象
     * @returns {object} - 处理后的点击处理器
     */
    handleClickEvent(clickEvent) {
        const action = clickEvent.action;
        const value = clickEvent.value;

        switch (action) {
            case 'open_url':
                return {
                    onclick: `window.open('${this.escapeHtml(value)}', '_blank')`
                };
            case 'run_command':
                return {
                    onclick: `rtextRunCommand('${this.escapeHtml(value)}')`
                };
            case 'suggest_command':
                return {
                    onclick: `rtextSuggestCommand('${this.escapeHtml(value)}')`
                };
            case 'change_page':
                return {
                    onclick: `rtextChangePage('${this.escapeHtml(value)}')`
                };
            case 'copy_to_clipboard':
                return {
                    onclick: `rtextCopyToClipboard('${this.escapeHtml(value)}')`
                };
            default:
                return null;
        }
    }

    /**
     * 处理悬停事件
     * @param {object} hoverEvent - 悬停事件对象
     * @returns {object} - 处理后的悬停处理器
     */
    handleHoverEvent(hoverEvent) {
        const action = hoverEvent.action;
        const value = hoverEvent.value;

        switch (action) {
            case 'show_text':
                let text = '';
                if (typeof value === 'string') {
                    text = value;
                } else if (typeof value === 'object') {
                    text = this.parse(value);
                }
                return {
                    title: text
                };
            case 'show_item':
                return {
                    title: `物品: ${JSON.stringify(value)}`
                };
            case 'show_entity':
                return {
                    title: `实体: ${JSON.stringify(value)}`
                };
            default:
                return null;
        }
    }

    /**
     * HTML转义
     * @param {string} text - 需要转义的文本
     * @returns {string} - 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 全局函数，供点击事件调用
window.rtextRunCommand = function(command) {
    // 这里可以集成到现有的命令发送系统
    if (window.sendCommand) {
        window.sendCommand(command);
    } else {
        console.log('执行命令:', command);
    }
};

window.rtextSuggestCommand = function(command) {
    // 建议命令到输入框
    const input = document.querySelector('input[type="text"]');
    if (input) {
        input.value = command;
        input.focus();
    }
};

window.rtextChangePage = function(page) {
    // 改变页面（如果支持）
    console.log('改变页面到:', page);
};

window.rtextCopyToClipboard = function(text) {
    // 复制到剪贴板
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('已复制到剪贴板:', text);
        });
    } else {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log('已复制到剪贴板:', text);
    }
};

// 创建全局实例
window.rtextParser = new RTextParser();

// 导出供模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RTextParser;
}
