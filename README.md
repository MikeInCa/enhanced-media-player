# Enhanced Media Player Pro

A comprehensive Electron-based media player with advanced magnifier technology and professional features.

![Enhanced Media Player](https://img.shields.io/badge/Electron-25.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Version](https://img.shields.io/badge/Version-1.0.0-orange)

## 🎬 Features

### Media Support
- **Video**: MP4, WebM, MOV, AVI, MKV, M4V, FLV, WMV
- **Audio**: MP3, WAV, OGG, AAC, FLAC, M4A, WMA
- **Images**: JPG, PNG, GIF, BMP, WebP, SVG, TIFF

### Advanced Magnifier System
- **DOM Overlay Magnifier** for normal viewing mode
- **Canvas-based Magnifier** for fullscreen mode
- **Cursor-following magnification** with adjustable zoom levels
- **Draggable magnifier** with visual crosshairs

### Professional Features
- Queue management with thumbnails
- Playlist save/load functionality
- Auto-save and restore sessions
- Drag & drop file support
- Dark/Light theme switching
- Comprehensive error handling and logging
- Performance monitoring

## 🎮 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Z` | Toggle magnifier |
| `F` | Toggle canvas fullscreen |
| `Space` | Play/Pause |
| `←/→` | Previous/Next media |
| `↑/↓` | Volume up/down |
| `+/-` | Adjust magnifier zoom |
| `M` | Toggle mute |
| `L` | Toggle loop mode |
| `T` | Toggle theme |

## 🚀 Installation & Usage

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd enhanced-media-player

# Install dependencies
npm install

# Run the application
npm start

# Development mode with logging
npm run dev

# Build for production
npm run build
```

### Usage
1. **Load Media**: Use "Select Files" or "Select Folder" buttons, or drag & drop files
2. **Magnifier**: Press `Z` to toggle the magnifier, `+/-` to zoom
3. **Fullscreen**: Press `F` for canvas fullscreen mode with integrated magnifier
4. **Playlists**: Save and load playlists using the playlist controls

## 🛡️ Security Features

- Context isolation enabled
- Node integration disabled in renderer process
- Comprehensive error handling and logging
- Secure IPC communication via preload script

## 🔧 Architecture

```
├── main.js          # Main Electron process
├── preload.js       # Security bridge for IPC
├── index.html       # UI and renderer logic
├── styles.css       # Enhanced styling with theme support
└── utils/
    └── errorHandler.js # Error management system
```

## 📊 Error Handling

The application includes a comprehensive error handling system:
- Real-time error logging
- Performance monitoring
- Memory usage tracking
- Graceful degradation
- Error export functionality

## 🎨 Themes

- **Light Theme**: Modern gradient design
- **Dark Theme**: Professional dark interface
- Smooth transitions and animations
- High contrast mode support

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 Bug Reports

Please use the GitHub issues page to report bugs or request features.

---

**Enhanced Media Player Pro** - Professional media playback with advanced magnification technology.