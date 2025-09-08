const express = require('express');
const path = require('path');

const app = express();
const port = 3001;

// Servir archivos estáticos
app.use(express.static(__dirname));
app.use(express.static('ui'));
app.use(express.static('src'));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta del panel de admin
app.get('/admin-panel.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../../ui/html/admin-panel.html'));
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`🌐 Servidor web corriendo en http://localhost:${port}`);
    console.log(`📱 Juego principal: http://localhost:${port}`);
    console.log(`👑 Panel de Admin: http://localhost:${port}/admin-panel.html`);
});