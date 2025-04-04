// 在页面加载前应用深色模式，避免闪烁
(function() {
    // 立即执行函数，在DOM解析前执行
    var savedTheme = localStorage.getItem('darkMode');
    
    // 如果有保存的主题设置，立即应用
    if (savedTheme !== null) {
        var isDark = savedTheme === 'true';
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    } 
    // 否则检查系统主题
    else {
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            document.documentElement.classList.add('dark');
        }
    }
})(); 