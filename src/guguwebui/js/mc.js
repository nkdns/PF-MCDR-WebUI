
function getServerStatus() {
    fetch('/api/get_server_status')
        .then(response => response.json())
        .then(jsonData => {
            const serverStatus = document.getElementById('Status-server-status');
            serverStatus.textContent = jsonData['status'];
            const serverVersion = document.getElementById('Status-server-version');
            serverVersion.textContent = jsonData['version'];
            const serverPlayers = document.getElementById('Status-players-online');
            serverPlayers.textContent = jsonData['players'];
        })
        .catch(error => {
            console.error('Error fetching data:', error)
            showMessage({type: '错误',content: '无法获取服务器状态，请检查终端输出日志。', autoCloseTime: 5000,});
        });
}