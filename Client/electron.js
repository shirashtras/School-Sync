const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // יצירת חלון הדפדפן
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'public/favicon.ico'), // אם יש אייקון
  });

  // טעינת אפליקציית React
  mainWindow.loadURL('http://localhost:5173'); // פורט ברירת המחדל של Vite

  // פתיחת DevTools בסביבת פיתוח
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// כאשר האפליקציה מוכנה, יצירת החלון
app.whenReady().then(createWindow);

// סגירת האפליקציה כאשר כל החלונות נסגרים (MacOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// הפעלה מחדש של החלון כאשר האייקון ב-MacOS נלחץ
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});