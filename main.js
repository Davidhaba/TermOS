const StorageManager = (() => {
  let inMemoryStorage = {};
  let isLocalStorageAvailable = false;

  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    isLocalStorageAvailable = true;
  } catch (e) {
    isLocalStorageAvailable = false;
  }

  return {
    getItem(key) {
      if (isLocalStorageAvailable) {
        try {
          return localStorage.getItem(key);
        } catch (e) { }
      }
      return inMemoryStorage[key] || null;
    },
    setItem(key, value) {
      if (isLocalStorageAvailable) {
        try {
          localStorage.setItem(key, value);
        } catch (e) { }
      }
      inMemoryStorage[key] = value;
    },
    removeItem(key) {
      if (isLocalStorageAvailable) {
        try {
          localStorage.removeItem(key);
        } catch (e) { }
      }
      delete inMemoryStorage[key];
    },
    isAvailable() {
      return isLocalStorageAvailable;
    }
  };
})();

class Modal {
  constructor(title = "Info") {
    this.appName = title;
    this.modWindow = document.createElement("div");
    this.modWindow.classList.add("modal-window");
    this.modWindow.tabIndex = 0;
    this.titleBar = document.createElement("div");
    this.titleBar.className = "title-bar";
    this.controls = document.createElement("div");
    this.controls.className = "controls";
    this.closeButton = document.createElement("div");
    this.closeButton.className = "control close";
    this.controls.appendChild(this.closeButton);
    this.closeButton.title = "Close";
    this.titleContainer = document.createElement("div");
    this.titleContainer.className = "title-container";
    this.title = document.createElement("div");
    this.title.className = "title";
    this.titleBar.appendChild(this.controls);
    this.titleBar.appendChild(this.titleContainer);
    this.titleContainer.appendChild(this.title);
    this.modWindow.appendChild(this.titleBar);
    document.body.appendChild(this.modWindow);
    this.appMain = document.createElement("div");
    this.appMain.classList.add("app-io");
    this.modWindow.appendChild(this.appMain);
    this.trackedListeners = [];
    this.isDragging = false;
    this.initialX = 0;
    this.initialY = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this._mouseMoveHandler = this.dragging.bind(this);
    this._touchMoveHandler = this.dragging.bind(this);
    this._mouseUpHandler = this.stopDragging.bind(this);
    this._touchEndHandler = this.stopDragging.bind(this);
    this.addTrackedListener(this.titleBar, "mousedown", (e) => this.startDragging(e));
    this.addTrackedListener(this.titleBar, "touchstart", (e) => this.startDragging(e), {
      passive: false
    });
    this.addTrackedListener(this.modWindow, "mousedown", (e) => {
      this.checkBlocking(e);
    });
    this.addTrackedListener(this.modWindow, "touchstart", (e) => {
      this.checkBlocking(e);
    });
    this.addTrackedListener(this.modWindow, "keydown", (e) => {
      if (e.code === "Escape" && this.closeButton) this.closeButton.click();
    });
    this.modWindow.style.left = `${Math.random() * 50 + 10}px`;
    this.modWindow.style.top = `${Math.random() * 50 + 10}px`;
    this.transitionTimer = null;
    this.activeTouchId = null;
    this.isBlocked = false;
    this.dialogApp = null;
    this.parentApp = null;
    this.childApps = [];
    this.setActiveWindow();
    this.updateTitle(title);

    window.openApplications.push(this);
  }
  checkBlocking(e = null) {
    if (this.isBlocked) {
      e && e.preventDefault();
      if (this.dialogApp) {
        this.dialogApp.setActiveWindow();
        return;
      }
      if (this.childApps && this.childApps.length === 0) {
        this.unblockWindow();
      }
    }
    this.setActiveWindow();
  }
  updateTitle(newTitle) {
    this.title.textContent = newTitle || this.title;
  }
  setApp() {
    const minButton = document.createElement("div");
    minButton.className = "control min";
    const maxButton = document.createElement("div");
    maxButton.className = "control max";
    this.controls.appendChild(minButton);
    this.controls.appendChild(maxButton);
    this.addTrackedListener(minButton, "click", () => this.handleMinimize());
    this.addTrackedListener(maxButton, "click", () => this.handleMaximize());
    minButton.title = "Minimize";
    maxButton.title = "Maximize";
    this.modWindow.classList.add("app-size");
    this.modWindow.style.width = window.innerWidth > 600 ? "600px" : "90vw";
    this.setupResizeHandle();
  }

  setupResizeHandle() {
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    this.modWindow.appendChild(resizeHandle);
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    const startResize = (e) => {
      if (!this.modWindow || this.isFullscreen || this.isBlocked) return;
      isResizing = true;
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = this.modWindow.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      this.modWindow.classList.add("resizing");
      e.preventDefault();
    };
    const doResize = (e) => {
      if (!this.modWindow || !isResizing || this.isFullscreen || this.isBlocked) return;
      const currentX = e.touches ? e.touches[0].clientX : e.clientX;
      const currentY = e.touches ? e.touches[0].clientY : e.clientY;
      const diffX = currentX - startX;
      const diffY = currentY - startY;
      const newWidth = Math.max(0, startWidth + diffX);
      const newHeight = Math.max(0, startHeight + diffY);
      this.modWindow.style.width = newWidth + 'px';
      this.modWindow.style.height = newHeight + 'px';
    };
    const stopResize = () => {
      if (!isResizing) return;
      isResizing = false;
      if (this.modWindow) this.modWindow.classList.remove("resizing");
    };
    this.addTrackedListener(resizeHandle, 'mousedown', startResize);
    this.addTrackedListener(resizeHandle, 'touchstart', startResize, { passive: false });
    this.addTrackedListener(document, 'mousemove', doResize);
    this.addTrackedListener(document, 'touchmove', doResize, { passive: false });
    this.addTrackedListener(document, 'mouseup', stopResize);
    this.addTrackedListener(document, 'touchend', stopResize);
  }

  addTrackedListener(element, event, handler, options = false) {
    element.addEventListener(event, handler, options);
    this.trackedListeners.push({ element, event, handler, options });
  }

  removeTrackedListener(element, event, handler, options = false) {
    element.removeEventListener(event, handler, options);
    this.trackedListeners = this.trackedListeners.filter(listener => !(listener.element === element && listener.event === event && listener.handler === handler));
  }

  removeAllListeners() {
    this.trackedListeners.forEach(({ element, event, handler, options }) => {
      try {
        element.removeEventListener(event, handler, options);
      } catch (e) { }
    });
    this.trackedListeners = [];
  }
  setupExitBtn(callback = null) {
    if (this.closeButton)
      this.addTrackedListener(this.closeButton, "click", () => this.handleClose(callback));
  }
  async handleClose(callback = null) {
    if (callback && typeof callback === 'function' && await callback() === false) return;

    if (this.modWindow) this.modWindow.style.animation = "anHide 0.1s forwards";
    setTimeout(() => {
      if (this.modWindow) {
        this.removeAllListeners();
        this.modWindow.style.display = "none";
        this.modWindow.remove();
        this.modWindow = null;
        this.childApps.forEach(app => app.handleClose());
      }
      const openWindows = document.querySelectorAll('.modal-window');
      if (openWindows.length === 0) {
        const desktop = document.querySelector('.desktop');
        if (desktop && typeof desktop.classList !== 'undefined') {
          desktop.classList.add('active');
          desktop.focus();
        }
      }
    }, 100);
  }
  setupInfoBtn(name, text) {
    if (!text) return;
    const button = document.createElement("div");
    button.className = "control info";
    button.innerHTML = "i";
    button.onclick = () => { new Dialog(name, `What is ${name}?`, text, 'info', ['Ok'], 'Ok', this); };
    this.titleBar.appendChild(button);
    button.title = "Info";
  }
  blockWindow() {
    this.isBlocked = true;
  }
  unblockWindow() {
    this.isBlocked = false;
  }
  handleMinimize(toggle = true) {
    if (toggle) {
      this.isMinimized = !this.isMinimized;
      this.handleMaximize(false);
      this.setTransition();
      this.modWindow.classList[this.isMinimized ? "add" : "remove"]("minimize");
    } else if (this.isMinimized) {
      this.isMinimized = false;
      this.modWindow.classList.remove("minimize");
    }
  }
  handleMaximize(toggle = true) {
    if (toggle) {
      this.handleMinimize(false);
      this.isFullscreen = !this.isFullscreen;
      this.setTransition();
      this.modWindow.classList[this.isFullscreen ? "add" : "remove"]("maximize");
    } else if (this.isFullscreen) {
      this.isFullscreen = false;
      this.modWindow.classList.remove("maximize");
      this.modWindow.style.top = "0";
      this.modWindow.style.left = "0";
    }
  }
  setTransition(transit = null) {
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
    }
    if (transit == "shadow") {
      if (this.modWindow) this.modWindow.style.transition = "box-shadow 0.3s";
    } else {
      if (this.modWindow) this.modWindow.style.transition = "all 0.3s";
    }
    this.transitionTimer = setTimeout(() => {
      if (this.modWindow) this.modWindow.style.transition = "";
      this.transitionTimer = null;
    }, 300);
  }
  startDragging(e) {
    if (this.isBlocked || this.isMinimized || e.target.closest(".controls") || e.target.closest(".control")) return;
    if (e.cancelable) e.preventDefault();
    this.handleMaximize(false);
    if (e.type === "touchstart") {
      const touch = e.changedTouches[e.changedTouches.length - 1];
      this.activeTouchId = touch.identifier;
      this.initialX = touch.clientX;
      this.initialY = touch.clientY;
    } else {
      this.initialX = e.clientX;
      this.initialY = e.clientY;
    }
    this.isDragging = true;
    this.titleBar.style.cursor = "grabbing";
    const rect = this.modWindow.getBoundingClientRect();
    this.offsetX = this.initialX - rect.left;
    this.offsetY = this.initialY - rect.top;
    this.addTrackedListener(document, "mousemove", this._mouseMoveHandler);
    this.addTrackedListener(document, "touchmove", this._touchMoveHandler, {
      passive: false
    });
    this.addTrackedListener(document, "mouseup", this._mouseUpHandler);
    this.addTrackedListener(document, "touchend", this._touchEndHandler);
  }

  dragging(e) {
    if (!this.isDragging) return;
    let clientX, clientY;
    if (e.type === "touchmove") {
      const touch = Array.from(e.touches).find(
        (t) => t.identifier === this.activeTouchId
      );
      if (!touch) return;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const vp = window.visualViewport || window;
    const newX = clientX - this.offsetX;
    const newY = clientY - this.offsetY;
    const appRect = this.modWindow.getBoundingClientRect();
    const maxX = vp.width - 30;
    const maxY = vp.height - 30;
    const boundedX = Math.max(0 - appRect.width + 30, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));
    this.modWindow.style.left = `${boundedX}px`;
    this.modWindow.style.top = `${boundedY}px`;
    if (e.cancelable) e.preventDefault();
  }
  stopDragging(e) {
    if (
      !this.isDragging ||
      (e.type === "touchend" &&
        Array.from(e.touches).find((t) => t.identifier === this.activeTouchId))
    )
      return;
    this.isDragging = false;
    this.activeTouchId = null;
    this.titleBar.style.cursor = "";
    this.removeTrackedListener(document, "mousemove", this._mouseMoveHandler);
    this.removeTrackedListener(document, "touchmove", this._touchMoveHandler);
    this.removeTrackedListener(document, "mouseup", this._mouseUpHandler);
    this.removeTrackedListener(document, "touchend", this._touchEndHandler);
  }
  setActiveWindow() {
    if (!this.modWindow?.classList.contains("active")) {
      document.querySelectorAll(".modal-window").forEach((window) => {
        window.classList.remove("active");
      });
      const desktop = document.querySelector('.desktop');
      if (desktop && desktop.classList.contains('active')) {
        desktop.classList.remove('active');
      }
      if (this.modWindow) {
        this.setTransition("shadow");
        this.modWindow.classList.add("active");
        this.bringToFront();
      }
    }
    if (this.modWindow && !this.modWindow.contains(document.activeElement)) this.modWindow.focus();
  }
  bringToFront() {
    const maxZ = Math.max(
      ...[...document.querySelectorAll(".modal-window")].map((w) =>
        parseInt(w.style.zIndex || 100, 10)
      )
    );
    if (this.modWindow) {
      this.modWindow.style.zIndex = maxZ + 1;
    }
  }
}

class Dialog {
  constructor(title, mainMessage, details, iconType, buttons, primaryButton, parentModal = null) {
    return new Promise(resolve => {
      const app = new Modal(title);
      const appMain = app.appMain;
      app.modWindow.classList.add('dialog');
      appMain.classList.add("padd");
      const standart = 'Cancel';
      app.setupExitBtn(async () => {
        closeDialog(standart);
        return false;
      });
      if (parentModal) {
        parentModal.blockWindow();
        parentModal.dialogApp = app;
        app.parentApp = parentModal;
        parentModal.childApps.push(app);
      }
      const buttonsHtml = buttons.map(label => {
        const isPrimary = label === primaryButton;
        const primaryClass = isPrimary ? ' primary' : '';
        return `<button class="mac-btn${primaryClass}" data-action="${label}">${label}</button>`;
      }).join('');
      appMain.innerHTML = `
                              <div class="icon-section">${icons[iconType] || ''}</div>
                                <div class="message-section">
                                    <h2>${mainMessage}</h2>
                                    <p>${details}</p>
                                </div>
                              `;
      const footer = document.createElement('div');
      footer.className = 'button-bar';
      footer.classList.add('title-bar');
      footer.innerHTML = buttonsHtml;
      app.modWindow.appendChild(footer);
      footer.querySelector('button.primary')?.focus();
      app.modWindow.style.width = 'auto';
      setTimeout(() => {
        const buttons = footer.querySelectorAll('button');
        let buttonsWidth = 40;
        buttons.forEach((btn, index) => {
          buttonsWidth += btn.offsetWidth;
          if (index < buttons.length - 1) buttonsWidth += 10;
        });
        app.modWindow.style.minWidth = buttonsWidth + 'px';
        app.modWindow.style.width = '';
      }, 10);

      const closeDialog = (result) => {
        if (parentModal) {
          const index = parentModal.childApps.indexOf(app);
          if (index > -1) {
            parentModal.childApps.splice(index, 1);
          }
        }
        app.handleClose();
        if (parentModal) {
          parentModal.dialogApp = null;
          parentModal.unblockWindow();
          parentModal.setActiveWindow();
        }
        resolve(result);
      };
      footer.querySelectorAll('[data-action]').forEach(btn => {
        app.addTrackedListener(btn, 'click', (e) => {
          const action = e.target.getAttribute('data-action') || standart;
          closeDialog(action);
        });
      });
    });
  }
}

class FileCopyManager {
  constructor() {
    this.app = new Modal("Copy Manager");
    this.appMain = this.app.appMain;
    this.appMain.classList.add("unarchive-manager-windows");
    this.app.setApp();
    this.app.setupExitBtn();
    this.app.setupInfoBtn('Copy Manager',
      'Copy Manager displays the progress and status of file copy operations with real-time updates.'
    );
    this.startTime = Date.now();
    this.initUI();
  }

  initUI() {
    this.appMain.innerHTML = `
      <div class="win-copy-dialog">
        <div class="win-copy-header">
          <div class="win-copy-icon"></div>
          <div class="win-copy-title-section">
            <div class="win-copy-main-text">Copying files...</div>
            <div class="win-copy-source">From: <span class="source-file">-</span></div>
            <div class="win-copy-dest">To: <span class="dest-path">/</span></div>
          </div>
        </div>

        <div class="win-copy-details">
          <div class="detail-row">
            <span class="detail-label">Current item:</span>
            <span class="current-item">-</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Progress:</span>
            <span class="progress-info">0/0 items</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Speed:</span>
            <span class="speed-info">- items/s</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Time elapsed:</span>
            <span class="time-info">00:00</span>
          </div>
        </div>

        <div class="win-copy-progress-section">
          <div class="win-progress-bar">
            <div class="win-progress-fill"></div>
            <span class="progress-percent">0%</span>
          </div>
        </div>
      </div>
    `;

    this.sourceFile = this.appMain.querySelector('.source-file');
    this.destPath = this.appMain.querySelector('.dest-path');
    this.currentItem = this.appMain.querySelector('.current-item');
    this.progressInfo = this.appMain.querySelector('.progress-info');
    this.speedInfo = this.appMain.querySelector('.speed-info');
    this.timeInfo = this.appMain.querySelector('.time-info');
    this.progressPercent = this.appMain.querySelector('.progress-percent');
    this.progressFill = this.appMain.querySelector('.win-progress-fill');
    this.mainText = this.appMain.querySelector('.win-copy-main-text');

    this.resetStats();
    this.startTimer();
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      this.timeInfo.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 100);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  resetStats() {
    this.itemsCopied = 0;
    this.totalItems = 0;
  }

  updateProgress(processed, total, currentFileName = null, sourcePath = null, destPath = null) {
    const percent = total > 0 ? (processed / total) * 100 : 0;

    if (sourcePath) this.sourceFile.textContent = sourcePath;
    if (destPath) this.destPath.textContent = destPath;
    if (currentFileName) this.currentItem.textContent = currentFileName;

    this.progressPercent.textContent = `${Math.floor(percent)}%`;
    this.progressInfo.textContent = `${processed}/${total} items`;
    this.progressFill.style.width = `${percent}%`;

    const elapsed = Math.max(1, (Date.now() - this.startTime) / 1000);
    const speed = (processed / elapsed).toFixed(1);
    this.speedInfo.textContent = `${speed} items/s`;

    this.app.updateTitle(`${Math.floor(percent)}% - Copy Manager`);
  }

  setStatus(statusText) {
    this.mainText.textContent = statusText;
  }

  setSuccess() {
    this.setStatus('Copy completed');
    this.progressPercent.textContent = '100%';
    this.progressFill.style.width = '100%';
    this.stopTimer();

    setTimeout(() => {
      this.app.handleClose();
    }, 10);
  }

  setError(errorMessage) {
    this.setStatus(`Error: ${errorMessage}`);
    this.mainText.style.color = '#ff6b6b';
    this.stopTimer();

    new Dialog(
      'Copy Manager - Error',
      'An error occurred during the operation',
      errorMessage,
      'error',
      ['OK'],
      'OK',
      this.app
    ).then(() => {
      this.app.handleClose();
    }).catch(() => {
      this.app.handleClose();
    });
  }
}

class Terminal {
  constructor(args = null) {
    this.appName = 'Termix';
    this.terminalApp = new Modal(this.appName);
    this.terminalWindow = this.terminalApp.appMain;
    this.terminalWindow.classList.add("padd");
    this.terminalMain = this.terminalApp.modWindow;
    this.updateTitle = this.terminalApp.updateTitle;
    this.history = [];
    this.historyIndex = -1;
    this.isDownloadedSpec = false;
    this.currentHint = null;
    this.init();
    this.commands = {
      help: {
        execute: this.help.bind(this),
        help: {
          description: "Show help information",
          usage: "help [command]",
          example: "help\nhelp cd"
        }
      },
      about: {
        execute: this.about.bind(this),
        help: {
          description: "Show information about the terminal",
          usage: "about"
        }
      },
      special: {
        execute: async () => {
          if (!this.isDownloadedSpec) {
            await this.simulateDownload(['3000', '10MB', 'Downloading...']);
            this.isDownloadedSpec = true;
          }
          this.isSpecialMode = true;
          this.addOutputLine('Entered special mode. Type "exit" to return.', 'info');
        },
        help: {
          description: "Enter special command mode",
          usage: "special",
        }
      },
      exit: {
        execute: this.exit.bind(this),
        help: {
          description: "Exit the terminal",
          usage: "exit",
        }
      },
      clear: {
        execute: this.clear.bind(this),
        help: {
          description: "Clear terminal screen",
          usage: "clear",
        }
      },
      ls: {
        execute: this.ls.bind(this),
        help: {
          description: "List directory contents",
          usage: "ls",
          example: "ls"
        }
      },
      mkdir: {
        execute: this.mkdir.bind(this),
        help: {
          description: "Create new directory",
          usage: "mkdir <directory_name>",
          example: "mkdir new_folder"
        }
      },
      cd: {
        execute: this.cd.bind(this),
        help: {
          description: "Change current directory",
          usage: "cd <path>",
          example: "cd folder\ncd .."
        }
      },
      touch: {
        execute: this.touch.bind(this),
        help: {
          description: "Create new empty file",
          usage: "touch <file_name>",
          example: "touch file.txt"
        }
      },
      rm: {
        execute: this.rm.bind(this),
        help: {
          description: "Remove file or directory",
          usage: "rm [-r] [-f] <path>",
          example: "rm old_file\nrm -r old_folder\nrm -f system_file"
        }
      },
      echo: {
        execute: this.echo.bind(this),
        help: {
          description: "Display message or write text to file",
          usage: "echo [text] > [filename]",
          example: 'echo Hello World\necho Hello World > file.txt'
        }
      },
      cat: {
        execute: this.cat.bind(this),
        help: {
          description: "Show file contents",
          usage: "cat <file_name>",
          example: "cat file.txt"
        }
      },
      pwd: {
        execute: this.pwd.bind(this),
        help: {
          description: "Print current working directory",
          usage: "pwd",
        }
      },
      mv: {
        execute: this.mv.bind(this),
        help: {
          description: "Move or rename files and directories",
          usage: "mv <source> <target>",
          example: "mv old.txt new.txt\nmv file.txt dir/"
        }
      },
      cp: {
        execute: this.cp.bind(this),
        help: {
          description: "Copy files and directories",
          usage: "cp <source> <target>",
          example: "cp file.txt backup/\ncp -r dir/ backup/"
        }
      },
      progress: {
        execute: async (args) => {
          try {
            await this.simulateDownload(args);
          } catch (error) {
            this.addOutputLine(error.message, 'error');
          }
        },
        help: {
          description: "Simulate file download with progress bar",
          usage: "progress [duration] [size] [label]",
          example: "progress 5000 20MB Downloading..."
        }
      },
      notepad: {
        execute: (args) => {
          const path = fileSystem.getResolvedPath(this.context.path, args[0])[0];
          try {
            if (path) {
              new TextEditor(null, path);
            } else {
              new TextEditor();
            }
          } catch (error) {
            this.addOutputLine(error.message, 'error');
          }
        },
        help: {
          description: "Open file in text editor",
          usage: "notepad [file_path]",
          example: "notepad\nnotepad ../folder/file.txt"
        }
      },
      run: {
        execute: (args) => fileSystem.openFile(fileSystem.getResolvedPath(this.context.path, args[0])[0], 'executable'),
        help: {
          description: "Execute application",
          usage: "run <file_path>",
          example: "run app.js"
        }
      },
      open: {
        execute: (args) => fileSystem.openFile(fileSystem.getResolvedPath(this.context.path, args[0])[0], args[1]),
        help: {
          description: "Open any file (auto-detect type)",
          usage: "open <file_path> [file_type](audio, video, image, text or executable)",
          example: "open document.txt\nopen folder/file text"
        }
      },
      download: {
        execute: this.download.bind(this),
        help: {
          description: "Download file from URL",
          usage: "download <url> [filename]",
          example: "download https://example.com/file.txt\n" +
            "download https://example.com/image.png myimage.png"
        }
      },
      unarchive: {
        execute: this.unarchive.bind(this),
        help: {
          description: "Extract a .zip archive.",
          usage: "unarchive <filename>",
          example: "unarchive archive.zip"
        }
      },
    };
    this.isSpecialMode = false;
    this.specialCommands = {
      exit: {
        execute: () => {
          this.isSpecialMode = false;
          this.addOutputLine('Exited special mode', 'info');
        },
        help: {
          description: "Exit special mode",
          usage: "exit",
        }
      },
      help: {
        execute: this.help.bind(this),
        help: {
          description: "Show help information",
          usage: "help [command]",
          example: "help\nhelp exit"
        }
      },
      calc: {
        execute: (args) => {
          try {
            const [mathExpression, result] = this.safeEval(args.join(' '));
            this.addOutputLine(`${mathExpression} = ${result}`);
          } catch (error) {
            this.addOutputLine(error.message, 'error');
          }
        },
        help: {
          description: "Calculate math expression",
          usage: "calc <expression>",
          example: "1+1\ncalc 2*(3+4)"
        }
      }
    };
  }
  init() {
    this.terminalApp.setupExitBtn();
    this.terminalApp.setApp();
    this.terminalApp.setupInfoBtn('Termix',
      'Termix is the terminal application within TermOS. Use it to manage files, edit text, and run utilities. Type "help" to see all available commands.'
    );
    this.context = new FileSystemClone();
    this.about();
    this.addOutputLine("Type 'help' for help");
    this.createInputLine();
    this.placeCaretAtEnd(this.input);
    this.terminalApp.addTrackedListener(this.terminalMain, 'keyup', () => this.placeCaretAtEnd(this.input));
    this.terminalApp.addTrackedListener(this.terminalWindow, 'click', () => this.input.focus());

    const keyboardControls = document.createElement('div');
    keyboardControls.classList.add("keyboard-controls");
    keyboardControls.innerHTML = `
            <button data-key="ArrowUp">${icons.arrowUp}</button>
            <button data-key="ArrowDown">${icons.arrowDown}</button>
            <button data-key="ArrowLeft">${icons.arrowLeft}</button>
            <button data-key="ArrowRight">${icons.arrowRight}</button>
            <button data-key="Tab">Tab</button>
            <button data-key="Enter" style="padding: 5px 15px;">${icons.enter}</button>
        `;
    this.terminalMain.appendChild(keyboardControls);
    let lastWinHeight = window.innerHeight;
    this.terminalApp.addTrackedListener(window, 'resize', () => {
      const currentHeight = window.innerHeight;
      if (currentHeight < lastWinHeight) {
        keyboardControls.classList.add('visible');
      } else {
        keyboardControls.classList.remove('visible');
      }
      lastWinHeight = currentHeight;
    });
    this.terminalApp.addTrackedListener(keyboardControls, 'touchstart', (e) => {
      if (e.target.tagName === 'BUTTON') {
        e.target.classList.add("active");
        this.startHandleKey = e.target.dataset.key;
      }
    });
    this.terminalApp.addTrackedListener(keyboardControls, 'mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') {
        e.target.classList.add("active");
        this.startHandleKey = e.target.dataset.key;
      }
    });
    this.terminalApp.addTrackedListener(keyboardControls, 'touchend', (e) => {
      const button = e.target.tagName === 'BUTTON' ? e.target : e.target.closest('button');
      if (button) {
        button.classList.remove("active");
        e.preventDefault();
        const key = e.target.dataset.key;
        if (!this.input || !key || !this.startHandleKey || key !== this.startHandleKey) return;
        this.startHandleKey = null;
        if (key === 'ArrowLeft') {
          const start = this.input.selectionStart;
          this.input.selectionEnd = start > 0 ? start - 1 : 0;
        } else if (key === 'ArrowRight') {
          const end = this.input.selectionEnd;
          const textLength = this.input.textContent.length;
          this.input.selectionStart = end < textLength ? end + 1 : textLength;
        } else {
          this.input.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true }));
        }
      }
    });
    this.terminalApp.addTrackedListener(keyboardControls, 'mouseup', (e) => {
      const button = e.target.tagName === 'BUTTON' ? e.target : e.target.closest('button');
      if (button) {
        button.classList.remove("active");
        e.preventDefault();
        const key = e.target.dataset.key;
        if (!this.input || !key || !this.startHandleKey || key !== this.startHandleKey) return;
        this.startHandleKey = null;
        if (key === 'ArrowLeft') {
          const start = this.input.selectionStart;
          this.input.selectionEnd = start > 0 ? start - 1 : 0;
        } else if (key === 'ArrowRight') {
          const end = this.input.selectionEnd;
          const textLength = this.input.textContent.length;
          this.input.selectionStart = end < textLength ? end + 1 : textLength;
        } else {
          this.input.dispatchEvent(new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true }));
        }
      }
    });
    keyboardControls.querySelectorAll('button').forEach((button) => {
      this.terminalApp.addTrackedListener(button, 'touchcancel', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.classList.contains("active")) {
          e.target.classList.remove("active");
          this.startHandleKey = null;
        }
      });
      this.terminalApp.addTrackedListener(button, 'mouseleave', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.classList.contains("active")) {
          e.target.classList.remove("active");
          this.startHandleKey = null;
        }
      });
    });
  }
  exit() {
    this.terminalApp.handleClose();
  }
  placeCaretAtEnd(input) {
    if (input) {
      input.focus();
      if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
        let range = document.createRange();
        range.selectNodeContents(input);
        range.collapse(false);
        let sel = window.getSelection();
        sel.removeAllRanges();
        if (range) sel.addRange(range);
      }
    }
  }
  createInputLine() {
    this.terminalApp.updateTitle(this.appName);
    const line = document.createElement('div');
    line.className = 'i-line';

    this.prompt = document.createElement('span');
    this.prompt.className = 'prompt';
    this.updatePrompt();

    this.input = document.createElement('span');
    this.input.className = 'stdin';
    this.input.contentEditable = true;
    this.input.setAttribute('autocorrect', 'off');
    this.input.setAttribute('autocapitalize', 'off');
    this.input.setAttribute('spellcheck', 'false');
    this.input.setAttribute('autocomplete', 'off');
    this.input.setAttribute('enterkeyhint', 'done');
    this.input.spellcheck = false;
    this.input.autocapitalize = 'none';
    this.input.autocorrect = 'off';

    line.appendChild(this.prompt);
    line.appendChild(this.input);
    this.terminalWindow.appendChild(line);

    this.terminalApp.addTrackedListener(this.input, 'input', () => this.updateHint());
    this.terminalApp.addTrackedListener(this.input, 'keydown', (e) => this.handleInput(e));
    this.terminalApp.addTrackedListener(this.input, 'mouseup', () => this.placeCaretAtEnd(this.input));
  }

  updatePrompt() {
    if (!this.isSpecialMode) this.prompt.textContent = `${this.appName}@${username}:${this.context.path}$`;
    else this.prompt.textContent = ">>>";
  }
  handleInput(e) {
    this.updatePrompt();
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        this.executeCommand(this.input.textContent.trim());
        this.updateHint();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.navigateHistory(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.navigateHistory(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.handleTab();
        break;
      case 'Tab':
        e.preventDefault();
        this.handleTab();
        break;
    }
  }
  addOutputLine(text, type = 'normal') {
    const line = document.createElement('div');
    line.className = 'o-line';
    if (type !== 'normal') {
      const badge = document.createElement('span');
      badge.className = `badge ${type}`;
      if (type === 'success') {
        badge.textContent = '✓';
      } else if (type === 'error') {
        badge.textContent = '!';
      } else if (type === 'info') {
        badge.textContent = 'i';
      }
      line.appendChild(badge);
    }
    const textNode = document.createTextNode(text);
    line.appendChild(textNode);
    this.terminalWindow.appendChild(line);
  }
  createNewInputLine() {
    this.input.contentEditable = false;
    this.createInputLine();
    this.placeCaretAtEnd(this.input);
  }
  scrollToBottom() {
    this.terminalWindow.scrollTop = this.terminalWindow.scrollHeight;
  }
  navigateHistory(direction) {
    this.historyIndex = Math.max(0,
      Math.min(this.history.length, this.historyIndex + direction));
    if (this.historyIndex >= 0 && this.historyIndex !== this.history.length) {
      const history = this.history[this.historyIndex];
      if (typeof history === 'string') this.input.textContent = history;
    } else {
      this.input.textContent = '';
    }
    this.updateHint();
    this.placeCaretAtEnd(this.input);
  }

  parseFullArguments(commandStr) {
    const parts = [];
    let inQuotes = false;
    let currentPart = '';
    for (let i = 0; i < commandStr.length; i++) {
      const char = commandStr[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
        if (inQuotes === false) {
          if (currentPart.length > 0) {
            parts.push(currentPart);
            currentPart = '';
          }
        }
      } else if (char === ' ' && !inQuotes) {
        if (currentPart.length > 0) {
          parts.push(currentPart);
        }
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    if (currentPart.length > 0) {
      parts.push(currentPart);
    }
    return parts;
  }

  async executeCommand(fullCommand) {
    this.scrollToBottom();
    this.input.contentEditable = false;
    if (fullCommand && this.history[this.history.length - 1] !== fullCommand) {
      this.history.push(fullCommand);
    }
    this.historyIndex = this.history.length;
    const commandChain = fullCommand.split('&&').map(cmd => cmd.trim()).filter(cmd => cmd);
    for (const commandStr of commandChain) {
      const fullArgs = this.parseFullArguments(commandStr);
      const command = fullArgs[0];
      const args = fullArgs.slice(1);
      try {
        this.terminalApp.updateTitle(command + ' - ' + this.appName);
        if (this.isSpecialMode) {
          if (!this.specialCommands[command]) {
            const [mathExpression, result] = this.safeEval(fullCommand);
            this.addOutputLine(`${mathExpression} = ${result}`);
            this.scrollToBottom();
          } else {
            await this.specialCommands[command].execute(args);
          }
        } else {
          if (this.commands[command]) {
            await this.commands[command].execute(args);
          } else {
            this.addOutputLine(`'${command.length > 15 ? command.substring(0, 15) + '...' : command}' is not recognized as a command`, 'error');
          }
        }
      } catch (error) {
        this.addOutputLine(error.message, 'error');
        break;
      }
    }
    this.createNewInputLine();
    this.scrollToBottom();
  }
  safeEval(expression) {
    const mathExpression = expression.replace(/[^0-9+\-*/%e^().\s]/g, '');
    if (mathExpression.trim() === '') {
      throw new Error("No valid mathematical expression to evaluate.");
    }
    try {
      const result = new Function(`"use strict"; return (${mathExpression})`)();
      return [mathExpression, result];
    } catch (error) {
      throw new Error(`Evaluation error: ${error.message}`);
    }
  }
  help(args) {
    let cmdSet = this.isSpecialMode ? this.specialCommands : this.commands;
    if (args.length === 0) {
      this.addOutputLine('Available commands:', 'info');
      this.addOutputLine('\n' + 'Command'.padEnd(11) + 'Description');
      Object.entries(cmdSet).forEach(([cmd, data]) => {
        this.addOutputLine(`${cmd?.padEnd(10)} - ${data?.help?.description ?? '...'}`);
      });
      this.addOutputLine('\nUse "help <command>" for details');
    } else {
      const command = args[0];
      if (cmdSet[command]) {
        const info = cmdSet[command].help;
        const des = info?.description;
        const us = info?.usage;
        const ex = info?.example?.replace(/\n/g, '\n  ');
        this.addOutputLine("Help for: " + command, 'info');
        if (des) this.addOutputLine("Description: " + des);
        if (us) this.addOutputLine(`Usage:      ${us}`);
        if (ex) this.addOutputLine(`Examples:\n  ${ex}`);
      } else {
        this.addOutputLine(`Command '${command}' not found`, 'error');
      }
    }
  }
  clear() {
    this.terminalWindow.innerHTML = '';
    this.addOutputLine('Terminal cleared', 'info');
  }
  about() {
    this.addOutputLine(`TermOS ${ver} - Termix (by David)`, 'info');
  }
  formatItemInfo(item) {
    return fileSystem.formatSize(fileSystem.getItemSize(item), item.type);
  }
  ls() {
    const files = fileSystem.ls(this.context.path);
    const currentDir = fileSystem._resolvePath(this.context.path);
    let parentDir;
    if (this.context.path !== '/') {
      parentDir = fileSystem._resolvePath(fileSystem._findParent(this.context.path));
    }
    if (!parentDir && (!files.length || files.length === 0)) {
      this.addOutputLine("Directory is empty.");
      return;
    }
    if (currentDir)
      this.addOutputLine('.'.padEnd(10) + ` [Current Directory] [${this.formatItemInfo(currentDir)}]`);
    if (parentDir)
      this.addOutputLine('..'.padEnd(10) + ` [Parent Directory] [${this.formatItemInfo(parentDir)}]`);
    files.forEach(file => {
      this.addOutputLine(file.name.padEnd(10) + ` [${file.type}] [${this.formatItemInfo(file)}]`);
    });
  }
  mkdir(args) {
    if (args.length === 0) {
      this.addOutputLine('Please specify directory name', 'error');
      return;
    }
    const success = fileSystem.mkdir(this.context.path, args[0]);
    if (success) {
      this.addOutputLine(`Directory '${args[0]}' created`);
    } else {
      this.addOutputLine(`Directory '${args[0]}' already exists`, 'error');
    }
  }
  cd(args) {
    if (args.length === 0) {
      this.addOutputLine('Please specify path', 'error');
      return;
    }
    const newPath = fileSystem.cd(this.context.path, args[0]);
    if (!newPath) {
      this.addOutputLine(`Invalid path: ${args[0]}`, 'error');
    }
    this.context.path = newPath;
  }
  touch(args) {
    if (args.length === 0) {
      throw new Error('Please specify filename');
    }
    const success = fileSystem.touch(this.context.path, args[0]);
    if (success) {
      this.addOutputLine(`File '${args[0]}' created`);
    } else {
      this.addOutputLine(`File '${args[0]}' already exists`, 'error');
    }
  }
  async rm(args) {
    if (args.length === 0) {
      throw new Error('Please specify path');
    }
    let recursive = false;
    let force = false;
    const forceIndex = args.indexOf('-f');
    if (forceIndex >= 0) {
      force = true;
      args.splice(forceIndex, 1);
    }
    const targetIndex = args.indexOf('-r');
    if (targetIndex >= 0) {
      recursive = true;
      args.splice(targetIndex, 1);
    }
    const fullPath = fileSystem.getResolvedPath(this.context.path, args[0])[0];
    try {
      const success = fileSystem.rm(fullPath, recursive, force);
      if (!success) {
        const errorMsg = recursive ?
          "Can't remove directory" :
          "Directory not empty, use -r for recursive removal";
        throw new Error(errorMsg);
      }
      this.addOutputLine(`'${args[0]}' removed`, 'success');
    } catch (e) {
      const message = e.message || String(e);
      if (message.includes("protected system") && !force) {
        const answer = await new Dialog('Force Remove', `Protected system ${message.includes('directory') ? 'directory' : message.includes('file') ? 'file' : 'item'}`, `${message}. Do you want to force removal?`, 'question', ['Cancel', 'Force'], 'Force', this.terminalApp);
        if (answer === 'Force') {
          try {
            const success = fileSystem.rm(fullPath, recursive, true);
            if (!success) {
              throw new Error(recursive ? "Can't remove directory" : "Directory not empty, use -r for recursive removal");
            }
            this.addOutputLine(`'${args[0]}' removed with -f`, 'success');
          } catch (secondError) {
            throw new Error(secondError.message || String(secondError));
          }
        } else {
          throw new Error(message);
        }
      } else {
        throw e;
      }
    }
  }
  async echo(args) {
    const input = args.join(' ');
    if (!input.includes('>')) {
      this.addOutputLine(input);
      return;
    }
    const parts = input.split(' > ').map(p => p.trim());
    if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
      throw new Error('Invalid syntax. Use: echo [text] > [filename]');
    }
    const [text, filePath] = parts;
    const [fullPath] = fileSystem.getResolvedPath(this.context.path, filePath);
    const target = fileSystem._resolvePath(fullPath);
    const success = await fileSystem.writeFile(fullPath, text);
    if (!success) throw new Error(`Failed to write to file '${fullPath}'`);
    this.addOutputLine(`Content written to '${fullPath}'`);
  }
  async cat(args) {
    if (args.length === 0) {
      throw new Error('Please specify filename');
    }
    const content = await fileSystem.decodeContent(fileSystem.readFile(fileSystem.getResolvedPath(this.context.path, args[0])[0], { asText: true }), 'text');
    if (content === null) {
      throw new Error(`File '${args[0]}' not found`);
    }
    this.addOutputLine(content);
  }
  pwd() {
    this.addOutputLine('Current directory: ' + this.context.path);
  }
  createProgressBar(label) {
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = `
            <div class="progress-column">
                <div class="progress-label">${label}</div>
                <div class="progress-container">
                  <div class="progress-track">
                      <div class="progress-fill"></div>
                  </div>
                  <div class="progress-details">
                      <span class="progress-percent">0%</span>
                      <span class="progress-size">0/0</span>
                  </div>
                </div>
            </div>
        `;
    this.terminalWindow.appendChild(progressBar);
    return progressBar;
  }
  updateProgressBar(progressBar, percent, loaded, total, label = null) {
    const percentElement = progressBar.querySelector('.progress-percent');
    const sizeElement = progressBar.querySelector('.progress-size');
    const fillElement = progressBar.querySelector('.progress-fill');
    const labelElement = progressBar.querySelector('.progress-label');
    if (labelElement && label && labelElement.textContent !== label) labelElement.textContent = label;
    const formattedPercent = Math.floor(percent);
    const formattedLoaded = fileSystem.formatSize(loaded);
    const formattedTotal = total > 0 ? fileSystem.formatSize(total) : '??';
    fillElement.style.width = `${percent}%`;
    percentElement.textContent = `${formattedPercent}%`;
    sizeElement.textContent = `${formattedLoaded}/${formattedTotal}`;
    this.terminalApp.updateTitle(`${label ? label + ' ' : ''}${formattedPercent}% - ` + this.appName);
  }
  async simulateDownload(args) {
    try {
      const duration = args[0] ? parseInt(args[0]) : 5000;
      const size = this.parseSize(args[1] || '5MB');
      const label = args.slice(2).join(' ') || "Simulation download";
      const progressBar = this.createProgressBar(label);
      let loaded = 0;
      const startTime = Date.now();
      const updateInterval = 100;
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      while (true) {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(100, (elapsed / duration) * 100);
        loaded = Math.min(size, (size * percent) / 100);
        this.updateProgressBar(progressBar, percent, loaded, size, label);
        if (percent >= 100) break;
        await delay(updateInterval);
      }
      this.addOutputLine("Download complete!", 'success');
    } catch (error) {
      this.addOutputLine(`Simulation error: ${error.message}`, 'error');
    }
  }
  parseSize(sizeStr) {
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };
    const match = sizeStr.match(/^(\d+)([KMGT]?B)$/i);
    if (!match) throw new Error('Invalid size format');
    const value = parseInt(match[1]);
    const unit = match[2].toUpperCase();
    if (!units[unit]) throw new Error('Unknown unit');
    return value * units[unit];
  }
  removeHint() {
    try {
      if (this.currentHint) {
        this.currentHint.remove();
        this.currentHint = null;
      }
    } catch { }
  }
  updateHint() {
    try {
      this.removeHint();
      const hint = this.getHints(this.input.textContent)[0];
      if (!hint || hint === '') return;
      this.currentHint = document.createElement('span');
      this.currentHint.className = 'stdin-hint';
      this.currentHint.textContent = hint;
      this.input.parentNode.appendChild(this.currentHint);
    } catch {
      this.removeHint();
    }
  }
  getHints(text) {
    if (!text) return null;
    const parts = text.split(' ');
    const currentWord = parts[parts.length - 1];
    const commands = this.isSpecialMode ? this.specialCommands : this.commands;
    if (parts.length === 1) {
      return Object.keys(commands)
        .filter(cmd => cmd.startsWith(currentWord))
        .map(cmd => cmd.slice(currentWord.length));
    }
    const command = parts[0];
    if (commands[command]) {
      return this.getCommandHints(command, parts.slice(1), currentWord);
    }
    return [''];
  }
  getCommandHints(command, args, currentWord) {
    switch (command) {
      case 'help':
        if (args.length <= 1)
          return Object.keys(this.isSpecialMode ? this.specialCommands : this.commands).filter(cmd => cmd.startsWith(currentWord)).map(cmd => cmd.slice(currentWord.length));
      case 'cd':
        if (args.length <= 1)
          return fileSystem.ls(this.context.path).filter(f => f.type === 'directory' && f.name.startsWith(currentWord)).map(f => f.name.slice(currentWord.length));
      case 'cat':
      case 'notepad':
      case 'run':
      case 'open':
      case 'unarchive':
        if (args.length <= 1)
          return fileSystem.ls(this.context.path).filter(f => f.type === 'file' && f.name.startsWith(currentWord)).map(f => f.name.slice(currentWord.length));
      case 'echo':
        if (args.length <= 2)
          return [];
      case 'rm':
      case 'cp':
      case 'mv':
        return fileSystem.ls(this.context.path).filter(f => f.name.startsWith(currentWord)).map(f => f.name.slice(currentWord.length));
      case 'calc':
        return ['+', '-', '*', '/', '%'].filter(op => op.startsWith(currentWord)).map(op => op.slice(currentWord.length));
      default:
        return [];
    }
  }
  handleTab() {
    if (this.currentHint) {
      const hintText = this.currentHint.textContent;
      this.input.textContent += hintText;
      this.updateHint();
      this.placeCaretAtEnd(this.input);
    }
  }
  mv(args) {
    if (args.length < 2) {
      throw new Error('Usage: mv [source] [target]');
    }
    const [source, target] = args;
    try {
      const sourceAbsPath = fileSystem.getResolvedPath(this.context.path, source)[0];
      const targetAbsPath = fileSystem.getResolvedPath(this.context.path, target)[0];
      fileSystem.mv(sourceAbsPath, targetAbsPath);
      this.addOutputLine(`Moved '${source}' to '${target}'`);
    } catch (e) {
      throw new Error(`Failed to move '${source}': ${e.message}`);
    }
  }
  cp(args) {
    if (args.length < 2) {
      throw new Error('Usage: cp [source] [target]');
    }
    const [source, target] = args;
    try {
      const sourceAbsPath = fileSystem.getResolvedPath(this.context.path, source)[0];
      const targetAbsPath = fileSystem.getResolvedPath(this.context.path, target)[0];
      fileSystem.cp(sourceAbsPath, targetAbsPath);
      this.addOutputLine(`Copied '${source}' to '${target}'`);
    } catch (e) {
      throw new Error(`Failed to copy '${source}': ${e.message}`);
    }
  }
  async download(args) {
    if (args.length < 1) throw new Error('Usage: download [url] [filename]');
    const [url, manualFilePath] = args;
    try {
      const progressBar = this.createProgressBar("Pending download...");
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');
      let fileName = manualFilePath;
      if (!fileName) {
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
          const match = contentDisposition.match(/filename[^;=\n]*=(?:(['"]).*?\1|[^;\n]*)/);
          if (match && match[0]) {
            fileName = match[0].split('=')[1].trim().replace(/['"]/g, '');
          }
        }
      }
      if (!fileName) {
        fileName = url.split('/').pop()?.split('?')[0];
      }
      if (!fileName || fileName === '') {
        throw new Error('Could not determine filename. Please specify manually.');
      }
      const [fullPath] = fileSystem.getResolvedPath(this.context.path, fileName);
      const total = parseInt(response.headers.get('Content-Length') || '0');
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          loaded += value.length;
          chunks.push(value);
        }
        const percent = total > 0 ? (loaded / total) * 100 : 0;
        this.updateProgressBar(progressBar, percent, loaded, total, "Downloading " + fileName);
      }
      this.updateProgressBar(progressBar, 99, loaded, total, "Saving to " + fullPath);
      const blob = new Blob(chunks);
      const content = new Uint8Array(await blob.arrayBuffer());
      const success = await fileSystem.writeFile(fullPath, content, true);
      if (!success) throw new Error('Failed to save file');
      this.updateProgressBar(progressBar, 100, loaded, total, "Saved to " + fullPath);
      this.addOutputLine("Download complete", 'success');
    } catch (error) {
      this.addOutputLine(`Download failed: ${error.message}`, 'error');
    }
  }
  async unarchive(args) {
    if (args.length < 1) {
      this.addOutputLine('Usage: unarchive <filename>', 'error');
      return;
    }
    const fileName = args[0];
    let progressBar = null;
    try {
      const [fullPath] = fileSystem.getResolvedPath(this.context.path, fileName);
      const file = fileSystem._resolvePath(fullPath);
      if (!file || file.type !== 'file') {
        throw new Error(`File not found: ${fileName}`);
      }
      progressBar = this.createProgressBar("Unpacking " + fileName);
      const extractedFiles = await fileSystem.unarchive(file, (processed, total, currentFile) => {
        const displayFile = currentFile || fileName;
        this.updateProgressBar(progressBar, (processed / total) * 100, processed, total, "Unpacking " + displayFile);
      });
      for (const item of extractedFiles) {
        if (item.isDirectory) {
          fileSystem.mkdirp(fileSystem.getResolvedPath(this.context.path, item.path)[0]);
        } else {
          const [newFilePath] = fileSystem.getResolvedPath(this.context.path, item.path);
          fileSystem.mkdirp(newFilePath.split('/').slice(0, -1).join('/'));
          await fileSystem.writeFile(newFilePath, item.content, true);
        }
      }
      this.addOutputLine(`Successfully unarchived into ${this.context.path}`, 'success');
      this.updateProgressBar(progressBar, 100, extractedFiles.length, extractedFiles.length, "Unpacked " + fileName);
    } catch (error) {
      if (progressBar) this.updateProgressBar(progressBar, 0, 0, 0, "Unpacking failed");
      this.addOutputLine(error.message, 'error');
    }
  }
}

class TextEditor {
  constructor(args = null, path = null) {
    this.path = path || args?.split(' -')[1] || null;
    this.name = this.path?.split('/').pop() || null;
    this.app = new Modal(`${this.name || 'New File'} - Text Editor`);
    this.app.setApp();
    this.app.setupInfoBtn('Text Editor',
      'Text Editor is a simple file editor for creating and saving text files in the virtual filesystem. It supports shortcuts like Ctrl+S to save and Ctrl+N for a new document.'
    );
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'text-editor';
    this.textarea.spellcheck = false;
    const toolbar = this.createToolbar();
    const infoBar = this.createInfoBar();
    this.app.appMain.appendChild(toolbar);
    this.app.appMain.appendChild(this.textarea);
    this.app.appMain.appendChild(infoBar);
    this.setupEventListeners();
    if (this.path) {
      this.loadFileContent();
    }
  }
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';
    const fileMenu = document.createElement('div');
    fileMenu.className = 'file-menu';
    const fileBtn = document.createElement('button');
    fileBtn.innerHTML = 'File';
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-content';
    const newBtn = document.createElement('button');
    newBtn.innerHTML = 'New File <span class="btnKeyInfo">Ctrl+N</span>';
    newBtn.onclick = async () => {
      await this.newFile();
    }
    const saveBtn = document.createElement('button');
    saveBtn.innerHTML = 'Save <span class="btnKeyInfo">Ctrl+S</span>';
    saveBtn.onclick = () => this.saveFile();
    const saveAsBtn = document.createElement('button');
    saveAsBtn.innerHTML = 'Save As...';
    saveAsBtn.onclick = () => this.saveFile(true);
    dropdown.appendChild(newBtn);
    dropdown.appendChild(saveBtn);
    dropdown.appendChild(saveAsBtn);
    fileMenu.appendChild(fileBtn);
    fileMenu.appendChild(dropdown);
    toolbar.appendChild(fileMenu);
    fileBtn.onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    };
    this.app.addTrackedListener(document, 'click', (e) => {
      dropdown.classList.remove('show');
    });
    return toolbar;
  }
  createInfoBar() {
    const infoBar = document.createElement('div');
    infoBar.className = 'editor-info-bar';
    infoBar.innerHTML = `
          <div class="info-item status" data-info="status"></div>
          <div class="info-item" data-info="lines">Lines: 0</div>
          <div class="info-item" data-info="chars">Chars: 0</div>
          <div class="info-item" data-info="size">Size: 0 B</div>
          <div class="info-item" data-info="encoding">UTF-8</div>
        `;
    return infoBar;
  }
  updateInfoBar() {
    const lines = this.textarea.value.split('\n').length;
    const chars = this.textarea.value.length;
    const size = new TextEncoder().encode(this.textarea.value).length;
    this.app.appMain.querySelector('[data-info="lines"]').textContent = `Lines: ${lines}`;
    this.app.appMain.querySelector('[data-info="chars"]').textContent = `Chars: ${chars}`;
    this.app.appMain.querySelector('[data-info="size"]').textContent = `Size: ${fileSystem.formatSize(size)}`;
    const file = fileSystem._resolvePath(this.path);
    this.app.appMain.querySelector('[data-info="encoding"]').textContent = (file?.type === "file" && file.parameters) ? file.parameters.encoding :
      "UTF-8";
  }
  setupEventListeners() {
    this.app.addTrackedListener(this.textarea, 'keydown', (e) => {
      this.updateInfoBar();
      if (e.ctrlKey) {
        switch (e.code) {
          case 'KeyS':
            e.preventDefault();
            this.saveFile();
            break;
          case 'KeyN':
            e.preventDefault();
            this.newFile();
            break;
        }
      }
    });
    this.app.addTrackedListener(this.textarea, 'keyup', () => this.updateInfoBar());
    this.updateInfoBar();
    this.app.setupExitBtn(async () => {
      if (await this.checkChanges()) {
        const isSave = await this.confirmSave();
        if (isSave === null) return false;
      }
    });
  }
  async confirmSave() {
    const answer = await new Dialog(
      'Unsaved Changes',
      'Save your changes?',
      'Your changes will be lost if you don\'t save them.',
      'question',
      ['Cancel', "Don't Save", 'Save'],
      'Save',
      this.app
    );
    if (answer === 'Save') {
      await this.saveFile();
      return true;
    } else if (answer === 'Cancel') {
      return null;
    }
  }
  async loadFileContent() {
    try {
      this.textarea.value = await this.getFileContent() || '';
      this.app.updateTitle(`${this.name} - Text Editor`);
      this.updateInfoBar();
    } catch (error) {
      this.showStatus(`Error loading file: ${error.message}`, 'error');
    }
  }
  async getFileContent() {
    return await fileSystem.decodeContent(await fileSystem.asyncReadFile(this.path), "text");
  }
  async checkChanges() {
    const text = this.textarea.value || "";
    if (!this.path) {
      if (text) return true;
    } else {
      const cont = await this.getFileContent() || "";
      if (cont !== text) {
        return true;
      }
    }
    return false;
  }
  async saveFile(isSaveAs = false) {
    try {
      const newPath = (isSaveAs || !this.path) ?
        prompt('Enter file path:', (this.path || '/home/untitled.txt')) :
        this.path;
      if (!newPath) return;
      const dirPath = newPath.split('/').slice(0, -1).join('/');
      fileSystem.mkdirp(dirPath);
      const success = await fileSystem.writeFile(newPath, this.textarea.value);
      if (success) {
        this.path = newPath;
        this.name = newPath.split('/').pop();
        this.app.updateTitle(`${this.name} - Text Editor`);
        this.showStatus('File saved successfully!', 'success');
      } else {
        throw new Error('Failed to save file');
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }
  async newFile() {
    if (await this.checkChanges()) {
      const isSave = await this.confirmSave();
      if (isSave === null) return;
    }
    this.path = '';
    this.name = 'New File';
    this.textarea.value = '';
    this.app.updateTitle(`${this.name} - Text Editor`);
    this.updateInfoBar();
  }
  showStatus(message, type = 'info') {
    const infoStatus = this.app.appMain.querySelector('[data-info="status"]');
    if (infoStatus) {
      const isExists = infoStatus.classList.contains('show');
      if (isExists) {
        infoStatus.classList.remove('show');
        setTimeout(() => {
          this.showStatus(message, type);
        }, 100);
        return;
      }
      infoStatus.textContent = message;
      infoStatus.className = `info-item status ${type}`;
      setTimeout(() => infoStatus.classList.add('show'), 0);
      if (this.statusTimer) {
        clearTimeout(this.statusTimer);
        this.statusTimer = null;
      }
      this.statusTimer = setTimeout(() => {
        infoStatus.classList.remove('show');
        this.statusTimer = null;
      }, 5000);
      return;
    }
  }
}

class ImageViewer {
  constructor(args = null, path = null) {
    path = path || args?.split(' -')[1] || null;
    this.app = new Modal("Image Viewer");
    this.app.setupExitBtn();
    this.app.setApp();
    this.app.setupInfoBtn('Image Viewer',
      'Image Viewer displays image files in a clean, focused window and supports common formats loaded from the filesystem.'
    );
    if (!path) {
      this.noImageError();
      return;
    }
    const name = path.split('/').pop();
    this.app.updateTitle(name + " - Image Viewer");
    this.appMain = this.app.appMain;
    this.img = document.createElement("img");
    this.img.className = "image-view";
    this.img.onload = () => {
      this.loader.style.display = 'none';
    };
    this.app.addTrackedListener(this.img, 'error', () => {
      this.loader.style.display = 'none';
      console.error("Image Viewer: an error occurred");
    });
    const imgElement = document.createElement("div");
    imgElement.className = "image-imgElement";
    this.loader = document.createElement('div');
    this.loader.className = "loading-spinner";
    this.loader.style.opacity = 1;
    imgElement.appendChild(this.img);
    imgElement.appendChild(this.loader);
    this.appMain.appendChild(imgElement);
    this.appMain.style.alignItems = "center";
    fileSystem.asyncReadFile(path).then((content) => {
      return fileSystem.decodeContent(content, 'url');
    }).then((url) => {
      this.img.src = url;
    }).catch((error) => {
      this.loader.style.display = 'none';
      alert("Error loading file: " + error.message);
    });
  }
  async noImageError() {
    await new Dialog('No Image', 'No image file specified', 'Please select an image file to view.', 'error', ['OK'], 'OK', this.app);
    this.app.handleClose();
  };
}

class FileExplorer {
  constructor(args = null, path = null) {
    const initialPath = path || args?.split(' -')[1] || null;
    this.app = new Modal("File Explorer");
    this.appMain = this.app.appMain;
    this.appMain.classList.add("padd");
    this.modWindow = this.app.modWindow;
    this.app.setApp();
    this.app.setupInfoBtn('File Explorer',
      'File Explorer lets you browse folders, open items, and manage files with sorting controls and a context menu for Open, Rename, Delete, and new items.'
    );
    this.selectedItems = new Set();
    this.ctrlSelectedItems = new Set();
    this.lastSelectedIndex = -1;
    this.renamingItem = null;
    this.viewMode = 'list';
    this.sortType = "name";
    this.sortOrder = "asc";
    this.contextMenu = null;
    this.initialPath = initialPath;
    this.initUI();
    this.noFilesFoundMessage = document.createElement('p');
    this.noFilesFoundMessage.className = 'search-no-results';
    this.noFilesFoundMessage.textContent = 'No files found.';
  }
  initUI() {
    this.app.setupExitBtn();
    this.context = new FileSystemClone();
    if (this.initialPath) {
      try {
        const resolved = fileSystem._resolvePath(this.initialPath);
        if (resolved && resolved.type === 'directory') {
          this.context.path = this.initialPath;
        }
      } catch (e) {
        console.warn('Invalid initial path:', this.initialPath);
      }
    }
    this.appMain.innerHTML = `
      <div class="explorer-container">
        <div class="explorer-sidebar">
          <div class="sidebar-section">
            <div class="sidebar-title">Quick Access</div>
            <div class="sidebar-items">
              <div class="sidebar-item" data-path="/home">${icons.folder} Home</div>
              <div class="sidebar-item" data-path="/bin/desktop">${icons.folder} Desktop</div>
            </div>
          </div>
          <div class="sidebar-section">
            <div class="sidebar-title">Bookmarks</div>
            <div class="sidebar-items" id="bookmarks-list"></div>
            <button class="add-bookmark-btn" title="Add bookmark">+ Add bookmark</button>
          </div>
        </div>
        <div class="explorer-main">
          <div class="explorer-toolbar">
            <button class="back-btn" title="Back">${icons.arrowLeft}</button>
            <button class="refresh-btn" title="Refresh">${icons.refresh}</button>
            <input class="search-input" type="text" placeholder="Search..." title="Ctrl+F">
            <div class="view-controls">
              <button class="view-btn" data-view="list" title="List view">${icons.listView}</button>
              <button class="view-btn" data-view="compact" title="Compact view">${icons.compactView}</button>
            </div>
          </div>
          <div class="breadcrumb-nav"></div>
          <div class="sort-controls">
            <button class="sort-btn" data-sort="name">Name ↑</button>
            <button class="sort-btn" data-sort="type">Type</button>
            <button class="sort-btn" data-sort="size">Size</button>
          </div>
          <div class="file-list"></div>
          <div class="explorer-statusbar">
            <span class="status-items-count">0 items</span>
            <span class="status-selected-count" style="display:none;"></span>
            <span class="status-total-size">0 B</span>
          </div>
        </div>
      </div>`;
    this.appMain.classList.add("explorer-app");
    [this.backBtn, this.refreshBtn, this.fileList, this.breadcrumbNav, this.statusBar, this.searchInput] = [
      "back-btn", "refresh-btn", "file-list", "breadcrumb-nav", "explorer-statusbar", "search-input"
    ].map((c) => this.appMain.querySelector(`.${c}`));
    this.sortButtons = this.appMain.querySelectorAll(".sort-btn");
    this.sidebarItems = this.appMain.querySelectorAll(".sidebar-item");
    this.addBookmarkBtn = this.appMain.querySelector(".add-bookmark-btn");
    this.appMain.classList.remove("padd");
    this.setupEvents();
    this.loadBookmarks();
    this.updateFileList();
  }
  setupEvents() {
    this.backBtn.onclick = () => this.navigateUp();
    this.refreshBtn.onclick = () => this.updateUI();

    this.app.addTrackedListener(this.searchInput, 'input', (e) => {
      this.filterFiles(e.target.value);
    });

    this.app.addTrackedListener(this.searchInput, 'keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Escape') {
        this.searchInput.value = '';
        this.filterFiles('');
      }
    });

    this.sidebarItems.forEach(item => {
      this.app.addTrackedListener(item, 'click', () => {
        const path = item.dataset.path;
        this.navigateTo(path);
      });
    });

    this.app.addTrackedListener(this.addBookmarkBtn, 'click', () => {
      this.addBookmark(this.context.path);
    });
    const viewButtons = this.appMain.querySelectorAll('.view-btn');
    viewButtons.forEach(btn => {
      this.app.addTrackedListener(btn, 'click', () => {
        viewButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewMode = btn.dataset.view;
        const sortControls = this.appMain.querySelector('.sort-controls');
        if (sortControls) sortControls.style.display = (this.viewMode === 'list') ? 'grid' : 'none';
        this.updateFileList();
      });
      if (btn.dataset.view === this.viewMode) {
        btn.classList.add('active');
      }
    });
    this.app.addTrackedListener(this.fileList, "click", (e) => {
      const t = e.target.closest(".file-item");
      if (!t) {
        this.clearSelection();
        this.updateStatusBar();
        return;
      }
      const items = Array.from(this.fileList.querySelectorAll(".file-item"));
      const currentIndex = items.indexOf(t);
      const itemName = t.dataset.name;
      if (e.shiftKey) {
        if (this.lastSelectedIndex < 0) {
          this.selectedItems.clear();
          this.ctrlSelectedItems.clear();
          this.selectedItems.add(itemName);
          this.lastSelectedIndex = currentIndex;
        } else {
          const start = Math.min(this.lastSelectedIndex, currentIndex);
          const end = Math.max(this.lastSelectedIndex, currentIndex);
          if (e.ctrlKey) {
            for (let i = start; i <= end; i++) {
              const name = items[i].dataset.name;
              this.ctrlSelectedItems.add(name);
              this.selectedItems.add(name);
            }
          } else {
            this.selectedItems.clear();
            this.ctrlSelectedItems.forEach(item => this.selectedItems.add(item));
            for (let i = start; i <= end; i++) {
              this.selectedItems.add(items[i].dataset.name);
            }
          }
        }
      } else if (e.ctrlKey) {
        if (this.selectedItems.has(itemName)) {
          this.selectedItems.delete(itemName);
          this.ctrlSelectedItems.delete(itemName);
        } else {
          this.ctrlSelectedItems.add(itemName);
          this.selectedItems.add(itemName);
        }
        this.lastSelectedIndex = currentIndex;
      } else if (this.selectedItems.has(itemName) && this.selectedItems.size === 1) {
        this.lastSelectedIndex = currentIndex;
      } else {
        this.selectedItems.clear();
        this.ctrlSelectedItems.clear();
        this.selectedItems.add(itemName);
        this.lastSelectedIndex = currentIndex;
      }
      this.updateFileSelection();
    });
    this.app.addTrackedListener(this.fileList, "dblclick", (e) => {
      const t = e.target.closest(".file-item");
      if (!t) return;
      if (!this.selectedItems.has(t.dataset.name)) {
        this.selectedItems.add(t.dataset.name);
      }
      if (this.selectedItems.size > 0) {
        const selected = Array.from(this.selectedItems);
        const files = this.getSortedFiles().filter(f => selected.includes(f.name));
        if (files.length > 0) {
          this.openSelected(files, this.context.path, selected);
        } else {
          this.updateFileList();
        }
      }
    });
    this.app.addTrackedListener(this.fileList, "contextmenu", (e) => {
      if (!e.isLongPress && (e.pointerType === 'touch' || e.type.startsWith('touch'))) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      this.showContextMenu(e);
    });
    this.setupLongPressMenu();

    this.sortButtons.forEach(
      (btn) => (btn.onclick = () => this.handleSort(btn.dataset.sort))
    );
    this.setupKeyboardShortcuts();
  }
  updateFileSelection() {
    this.fileList.querySelectorAll(".file-item").forEach((item) => {
      if (this.selectedItems.has(item.dataset.name)) {
        item.classList.add("selected");
      } else {
        item.classList.remove("selected");
      }
    });
    this.updateStatusBar();
  }
  setupKeyboardShortcuts() {
    this.keydownHandler = (e) => {
      if (!this.modWindow || !this.modWindow.classList.contains("active") || e.target.tagName === 'INPUT') return;

      if (e.key === 'Delete') {
        e.preventDefault();
        if (this.selectedItems.size > 0) {
          this.deleteSelectedMultiple();
        }
      } else if (e.ctrlKey) {
        switch (e.code) {
          case 'KeyF':
            e.preventDefault();
            this.searchInput.focus();
            break;
          case 'KeyC':
            e.preventDefault();
            if (this.selectedItems.size > 0) {
              this.copySelected();
            }
            break;
          case 'KeyX':
            e.preventDefault();
            if (this.selectedItems.size > 0) {
              this.cutSelected();
            }
            break;
          case 'KeyV':
            e.preventDefault();
            this.pasteSelected();
            break;
          case 'KeyA':
            e.preventDefault();
            this.selectAll();
            break;
        }
      } else if (e.key === 'Enter' && this.selectedItems.size > 0) {
        e.preventDefault();
        const files = this.getSortedFiles().filter(f => this.selectedItems.has(f.name));
        if (files.length > 0) {
          this.openSelected(files, this.context.path, this.selectedItems);
        } else {
          this.updateFileList();
        }
      } else if (e.key === 'F2' && this.selectedItems.size === 1) {
        e.preventDefault();
        const firstSelected = Array.from(this.selectedItems)[0];
        this.renameSelected(null, this.context.path, firstSelected);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const items = Array.from(this.fileList.querySelectorAll(".file-item"));
        if (items.length === 0) return;
        let currentIndex = items.findIndex(item => this.selectedItems.has(item.dataset.name));
        if (currentIndex === -1) {
          currentIndex = e.key === 'ArrowUp' ? items.length - 1 : 0;
        } else {
          currentIndex += e.key === 'ArrowUp' ? -1 : 1;
          if (currentIndex < 0) currentIndex = items.length - 1;
          if (currentIndex >= items.length) currentIndex = 0;
        }
        this.clearSelection();
        this.selectedItems.add(items[currentIndex].dataset.name);
        this.updateFileSelection();
      } else if (e.key === 'F5') {
        e.preventDefault();
        this.updateUI();
      } else if (e.key === 'F3') {
        e.preventDefault();
        this.searchInput.focus();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        this.navigateUp();
      } else if (e.key === 'F7') {
        e.preventDefault();
        this.createNewFolder();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (this.selectedItems.size > 0) {
          this.deleteSelectedMultiple();
        }
      }
    };
    this.app.addTrackedListener(this.modWindow, 'keydown', this.keydownHandler);
  }

  setupLongPressMenu() {
    let longPressTimer = null;
    let longPressTarget = null;
    let touchStartEvent = null;
    const startLongPress = (e) => {
      const renameInput = this.fileList.querySelector('.rename-input');
      if (renameInput && renameInput.contains(e.target)) {
        e.stopPropagation();
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        return;
      }
      longPressTarget = e.target.closest(".file-item");
      touchStartEvent = e;
      if (e.target.closest(".emptyFolder")) return;
      longPressTimer = setTimeout(() => {
        if (longPressTarget) {
          if (!this.selectedItems.has(longPressTarget.dataset.name)) {
            this.clearSelection();
            this.selectedItems.add(longPressTarget.dataset.name);
          }
        } else {
          this.clearSelection();
        }
        const touch = touchStartEvent.touches[0];
        const synthEvent = new MouseEvent('contextmenu', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          pageX: touch.pageX,
          pageY: touch.pageY,
          bubbles: true,
          cancelable: true
        });
        synthEvent.isLongPress = true;
        this.fileList.dispatchEvent(synthEvent);
      }, 500);
    };
    const endLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      longPressTarget = null;
      touchStartEvent = null;
    };
    this.app.addTrackedListener(this.fileList, 'touchstart', startLongPress, { passive: true });
    this.app.addTrackedListener(this.fileList, 'touchend', endLongPress);
    this.app.addTrackedListener(this.fileList, 'touchmove', endLongPress);
    this.app.addTrackedListener(this.fileList, 'touchcancel', endLongPress);
  }
  updatePath() {
    this.currentPath.readOnly = true;
    const enteredPath = this.currentPath.value;
    try {
      const item = fileSystem._resolvePath(enteredPath);
      if (item && item.type) {
        if (item.type === 'file') fileSystem.openFile(enteredPath);
        else if (item.type === 'directory') this.context.path = fileSystem.cd(this.context.path, enteredPath);
        else new Dialog('File Explorer - Error', 'Unknown item type', `The item '${item.name}' has an unknown type and cannot be opened.`, 'error', ['Ok'], 'Ok', this.app);
      }
    } catch (e) {
      new Dialog("File Explorer - Error", "An error occurred", e.message, "error", ['Ok'], 'Ok', this.app);
    }
    this.updateUI();
  }
  handleSort(type) {
    this.sortOrder =
      this.sortType === type ?
        this.sortOrder === "asc" ?
          "desc" :
          "asc" :
        "asc";
    this.sortType = type;
    this.updateFileList();
    this.sortButtons.forEach((btn) => {
      btn.textContent = (btn.dataset.sort === "name" ? "Name" : btn.dataset.sort === "type" ? "Type" : "Size") +
        (btn.dataset.sort === this.sortType ? this.sortOrder === "asc" ? " ↑" : " ↓" : "");
    });
  }

  getSortedFiles() {
    let files = fileSystem.ls(this.context.path) || [];
    return files.sort((a, b) => {
      let res = 0;
      if (this.sortType === "name") {
        res = a.name.localeCompare(b.name);
      } else if (this.sortType === "type") {
        res = a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1;
      } else if (this.sortType === "size") {
        const sizeA = fileSystem.getItemSize(a);
        const sizeB = fileSystem.getItemSize(b);
        res = sizeA - sizeB;
      }
      return this.sortOrder === "asc" ? res : -res;
    });
  }
  formatItemInfo(item) {
    return fileSystem.formatSize(fileSystem.getItemSize(item), item.type);
  }

  escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  updateFileList() {
    const currentDir = fileSystem._resolvePath(this.context.path);
    if (!currentDir) {
      this.navigateUp();
      return;
    }
    const files = this.getSortedFiles();
    const selectedArray = Array.from(this.selectedItems);
    const validSelected = selectedArray.filter(name => files.find((f) => f.name === name));
    if (validSelected.length !== selectedArray.length) {
      validSelected.forEach(name => this.selectedItems.add(name));
      selectedArray.forEach(name => {
        if (!files.find((f) => f.name === name)) {
          this.selectedItems.delete(name);
        }
      });
    }
    if (this.renamingItem && !files.find((f) => f.name === this.renamingItem)) {
      this.renamingItem = null;
    }
    this.fileList.innerHTML =
      files.map((f) => {
        const isRenaming = this.renamingItem === f.name;
        const fileNameHtml = isRenaming
          ? `<input class="rename-input" type="text" value="${this.escapeHtml(f.name)}" />`
          : this.escapeHtml(f.name);

        if (this.viewMode === 'compact') {
          return `
      <div class="file-item compact ${f.type} ${this.selectedItems.has(f.name) ? 'selected' : ''} ${isRenaming ? 'renaming' : ''}" data-name="${this.escapeHtml(f.name)}" title="${f.name}">
          <span class="file-icon">${this.getFileIcon(f)}</span>
          <span class="file-name">${fileNameHtml}</span>
      </div>`;
        } else {
          return `
      <div class="file-item ${f.type} ${this.selectedItems.has(f.name) ? 'selected' : ''} ${isRenaming ? 'renaming' : ''}" data-name="${this.escapeHtml(f.name)}">
          <span class="file-icon">${this.getFileIcon(f)}</span>
          <span class="file-name">${fileNameHtml}</span>
          <span class="file-type">${f.type === 'directory' ? 'Folder' : f.type === 'file' ? fileSystem.getFileType(f.name).display : f.type.charAt(0).toUpperCase() + f.type.slice(1).toLowerCase()}</span>
          <span class="file-size">${this.formatItemInfo(f)}</span>
      </div>`;
        }
      })
        .join("") || '<p class="emptyFolder">This folder is empty.</p>';
    if (this.selectedItems.size > 0) {
      const firstSelected = Array.from(this.selectedItems)[0];
      const selectedElement = this.fileList.querySelector(`.file-item[data-name="${this.escapeHtml(firstSelected)}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView();
      }
    }
    const renameInput = this.fileList.querySelector('.rename-input');
    if (renameInput) {
      const oldName = this.renamingItem;
      const commitRename = (value) => {
        if (!this.renamingItem) {
          this.updateFileList();
          return;
        }
        const trimmed = String(value || '').trim();
        if (!trimmed || trimmed === oldName) {
          this.renamingItem = null;
          this.updateFileList();
          return;
        }

        const matches = fileSystem.checkForbiddenChars(trimmed);
        if (matches) {
          alert(`The filename contains forbidden characters: ${matches.join(', ')}`);
          return;
        }

        try {
          fileSystem.mv(
            fileSystem.getResolvedPath(this.context.path, oldName)[0],
            fileSystem.getResolvedPath(this.context.path, trimmed)[0]
          );
          this.selectedItems.delete(oldName);
          this.selectedItems.add(trimmed);
        } catch (e) {
          new Dialog('File Explorer - Error', 'An error occurred', e.message, 'error', ['Ok'], 'Ok', this.app);
        }
        this.renamingItem = null;
        this.updateFileList();
      };
      let renameCommittedByEnter = false;
      this.app.addTrackedListener(renameInput, 'keydown', (e) => {
        if (!this.renamingItem || this.selectedItem !== this.renamingItem) return;
        e.stopPropagation();
        if (e.code === 'Enter') {
          e.preventDefault();
          renameCommittedByEnter = true;
          this.app?.setActiveWindow();
          commitRename(renameInput.value);
        } else if (e.code === 'Escape') {
          e.preventDefault();
          renameCommittedByEnter = true;
          this.renamingItem = null;
          this.updateFileList();
          this.app?.setActiveWindow();
        }
      });
      this.app.addTrackedListener(renameInput, 'blur', () => {
        if (renameCommittedByEnter) {
          renameCommittedByEnter = false;
          return;
        }
        commitRename(renameInput.value);
      });
      this.app.addTrackedListener(renameInput, 'click', (e) => {
      });
      this.app.addTrackedListener(renameInput, 'dblclick', (e) => {
        e.stopPropagation();
      });
      this.app.addTrackedListener(renameInput, 'contextmenu', (e) => {
        e.stopPropagation();
      });
      renameInput.focus();
      renameInput.select();
    }
    this.updateBreadcrumb();
    this.updateStatusBar();
  }
  getFileIcon(f) {
    if (f.parameters?.icon) return f.parameters.icon;
    if (f.type === "directory" && icons.folder) return icons.folder;
    if (f.type === "file") {
      let fileType = fileSystem.getFileType(f.name).type;
      fileType = 'file' + fileType.charAt(0).toUpperCase() + fileType.slice(1).toLowerCase();
      if (icons[fileType]) return icons[fileType];
    }
    if (f.type === "link" && icons.shortcut) return icons.shortcut;
    return icons.file;
  }
  navigateUp() {
    try {
      const newPath = fileSystem.cd(this.context.path, "..");
      if (newPath) this.context.path = newPath;
      this.updateUI();
    } catch (e) {
      new Dialog('File Explorer - Error', 'An error occurred', e.message, 'error', ['Ok'], 'Ok', this.app);
    }
  }
  createNewFolder() {
    let newName = "New Folder";
    let counter = 0;
    while (fileSystem.ls(this.context.path).some(item => item.name === newName)) {
      counter++;
      newName = `New Folder (${counter})`;
    }
    fileSystem.mkdir(this.context.path, newName);
    this.clearSelection();
    this.renamingItem = newName;
    this.selectedItems.add(newName);
    this.updateFileList();
  }
  showContextMenu(e) {
    if (this.contextMenu) this.contextMenu.remove();
    const savedPath = this.context.path;
    const savedSelectedArray = Array.from(this.selectedItems);
    const selectedFiles = savedSelectedArray.map(name => fileSystem.ls(savedPath).find((f) => f.name === name)).filter(Boolean);
    const clipboardData = JSON.parse(StorageManager.getItem('fileExplorerClipboard') || 'null');
    const hasClipboard = clipboardData && clipboardData.paths && clipboardData.paths.length > 0;

    this.contextMenu = document.createElement("div");
    this.contextMenu.className = "context-menu";
    let html = "";

    if (selectedFiles.length > 0) {
      const isSingleSelection = selectedFiles.length === 1;
      const firstFile = selectedFiles[0];
      const isArchive = firstFile.type === 'file' && fileSystem.getFileType(firstFile.name).type === "archive";

      if (isSingleSelection) {
        if (firstFile.type === "file") {
          html += `<div class="menu-item open">${icons.openFile}Open file</div>`;
          html += `<div class="menu-item open-as">${icons.openAs}Open as</div>`;
          html += `<hr class="menu-separator">`;
        } else if (firstFile.type === "directory") {
          html += `<div class="menu-item open">${icons.openFolder}Open Folder</div>`;
          html += `<div class="menu-item open-new-window">${icons.openNewWindow}Open in New Window</div>`;
          html += `<hr class="menu-separator">`;
        }
      }

      html += `<div class="menu-item copy">${icons.copy}Copy</div>`;
      html += `<div class="menu-item cut">${icons.cut}Cut</div>`;
      if (hasClipboard) {
        html += `<div class="menu-item paste">${icons.paste}Paste</div>`;
      }
      html += `<div class="menu-item copyPath">${icons.copy}Copy ${selectedFiles.length > 1 ? `Paths (${selectedFiles.length})` : 'File Path'}</div>`;
      html += `<hr class="menu-separator">`;

      if (isSingleSelection) {
        html += `<div class="menu-item rename">${icons.rename}Rename</div>`;
        if (isArchive) {
          html += `<div class="menu-item unarchive">${icons.unarchive}Unarchive</div>`;
        }
      }
      html += `<div class="menu-item delete">${icons.delete}Delete${selectedFiles.length > 1 ? ` (${selectedFiles.length})` : ''}</div>`;
    } else {
      if (hasClipboard) {
        html += `<div class="menu-item paste">${icons.paste}Paste</div>`;
        html += `<hr class="menu-separator">`;
      }
      html += `<div class="menu-item new-folder">${icons.newFolder}New Folder</div>`;
      html += `<div class="menu-item new-file">${icons.newFile}New File</div>`;
      html += `<hr class="menu-separator">`;
      html += `<div class="menu-item copyPath">${icons.copy}Copy Current Path</div>`;
      html += `<div class="menu-item refresh">${icons.refresh}Refresh</div>`;
    }
    this.contextMenu.innerHTML = html;

    if (selectedFiles.length > 0) {
      const openBtn = this.contextMenu.querySelector(".open");
      if (openBtn) {
        openBtn.onclick = () => {
          this.openSelected(selectedFiles, savedPath, selectedFiles.map(f => f.name));
        };
      }
      if (selectedFiles[0].type === "file") {
        const openAsBtn = this.contextMenu.querySelector(".open-as");
        if (openAsBtn) {
          openAsBtn.onclick = () => {
            this.openAsSelected(selectedFiles[0], savedPath, selectedFiles[0].name);
            this.clearSelection();
          };
        }
      } else if (selectedFiles[0].type === "directory") {
        const openNewWindowBtn = this.contextMenu.querySelector(".open-new-window");
        if (openNewWindowBtn) {
          openNewWindowBtn.onclick = () => {
            new FileExplorer(null, fileSystem.getResolvedPath(savedPath, selectedFiles[0].name)[0]);
          };
        }
      }
      const copyBtn = this.contextMenu.querySelector(".copy");
      if (copyBtn) {
        copyBtn.onclick = () => {
          this.copySelected();
        };
      }
      const cutBtn = this.contextMenu.querySelector(".cut");
      if (cutBtn) {
        cutBtn.onclick = () => {
          this.cutSelected();
        };
      }
      const pasteBtn = this.contextMenu.querySelector(".paste");
      if (pasteBtn) {
        pasteBtn.onclick = () => {
          this.pasteSelected();
        };
      }
      const renameBtn = this.contextMenu.querySelector(".rename");
      if (renameBtn) {
        renameBtn.onclick = () => {
          this.renameSelected(selectedFiles[0], savedPath, selectedFiles[0].name);
        };
      }
      const unArchiveEl = this.contextMenu.querySelector(".unarchive");
      if (unArchiveEl) {
        unArchiveEl.onclick = async () => {
          this.unarchiveFile(selectedFiles[0], savedPath);
        };
      }
      const deleteBtn = this.contextMenu.querySelector(".delete");
      if (deleteBtn) {
        deleteBtn.onclick = async () => {
          await this.deleteSelectedMultiple(selectedFiles, savedPath);
        };
      }
      const copyPathBtn = this.contextMenu.querySelector(".copyPath");
      if (copyPathBtn) {
        copyPathBtn.onclick = () => {
          const paths = selectedFiles.map(f => fileSystem.getResolvedPath(savedPath, f.name)[0]).join('\n');
          this.copyPath(savedPath, null, paths);
        };
      }
    } else {
      const pasteBtn = this.contextMenu.querySelector(".paste");
      if (pasteBtn) {
        pasteBtn.onclick = () => {
          this.pasteSelected();
        };
      }
      const newFolderBtn = this.contextMenu.querySelector(".new-folder");
      if (newFolderBtn) {
        newFolderBtn.onclick = () => {
          this.createNewFolder();
        };
      }
      const newFileBtn = this.contextMenu.querySelector(".new-file");
      if (newFileBtn) {
        newFileBtn.onclick = () => {
          this.createNewFile();
        };
      }
      const refreshBtn = this.contextMenu.querySelector(".refresh");
      if (refreshBtn) {
        refreshBtn.onclick = () => {
          this.updateUI();
        };
      }
      const copyPathBtn = this.contextMenu.querySelector(".copyPath");
      if (copyPathBtn) {
        copyPathBtn.onclick = () => {
          this.copyPath(savedPath, null);
        };
      }
    }

    this.appMain.appendChild(this.contextMenu);
    const r = this.modWindow.getBoundingClientRect();
    const x = Math.max(
      10,
      Math.min(
        e.pageX - r.left - window.scrollX,
        r.width - this.contextMenu.offsetWidth
      )
    );
    const y = Math.max(
      10,
      Math.min(
        e.pageY - r.top - window.scrollY,
        r.height - this.contextMenu.offsetHeight
      )
    );
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.app.addTrackedListener(document, "click", (e) => {
      this.contextMenu?.remove();
    }, { once: true });
  }
  clearSelection() {
    this.selectedItems.clear();
    this.ctrlSelectedItems.clear();
    this.lastSelectedIndex = -1;
    this.fileList
      .querySelectorAll(".file-item")
      .forEach((i) => i.classList.remove("selected"));
  }
  createNewFile() {
    let newName = "New File";
    let counter = 0;
    while (fileSystem.ls(this.context.path).some(item => item.name === newName)) {
      counter++;
      newName = `New File (${counter})`;
    }
    fileSystem.touch(this.context.path, newName);
    this.clearSelection();
    this.renamingItem = newName;
    this.selectedItems.add(newName);
    this.updateFileList();

  }
  updateUI() {
    this.fileList.innerHTML = "";
    this.renamingItem = null;
    this.loadBookmarks();
    setTimeout(() => this.updateFileList(), 10);
  }
  openSelected(selectedFiles = [], path = null, selectedItems = []) {
    if (!path) path = this.context.path;
    if (!selectedItems) selectedItems = this.selectedItems;
    if (!selectedFiles) {
      selectedFiles = fileSystem.ls(path).filter((f) => selectedItems.has(f.name));
    }
    if (!selectedFiles) return;
    for (let i = 0; i < selectedFiles.length; i++) {
      const selectedFile = selectedFiles[i];
      if (selectedFile.type === "directory") {
        try {
          if (i > 0) {
            new FileExplorer(null, fileSystem.getResolvedPath(path, selectedFile.name)[0]);
          } else {
            const newPath = fileSystem.cd(path, selectedFile.name);
            this.context.path = newPath;
            this.updateUI();
          }
        } catch (e) {
          new Dialog('File Explorer - Error', 'An error occurred', e.message, 'error', ['Ok'], 'Ok', this.app);
        }
      } else if (selectedFile.type === "file") {
        try {
          fileSystem.openFile(fileSystem.getResolvedPath(path, selectedFile.name).filter(Boolean).join(' '));
        } catch (e) {
          new Dialog('File Explorer - Error', 'An error occurred', e.message, 'error', ['Ok'], 'Ok', this.app);
        }
      } else {
        new Dialog('File Explorer - Error', 'Unknown item type', `The selected item "${selectedFile.name}" has an unknown type and cannot be opened.`, 'error', ['Ok'], 'Ok', this.app);
      }
    }
  }
  openAsSelected(file = null, path = null, selectedItem = null) {
    if (!path) path = this.context.path;
    if (!file) file = fileSystem.ls(path).find((f) => f.name === selectedItem);
    if (file) {
      fileSystem.showAppPicker(fileSystem.getResolvedPath(path, file.name).filter(Boolean).join(' '));
    }
  }
  renameSelected(file = null, path = null, selectedItem = null) {
    if (selectedItem) {
      this.selectedItems.clear();
      this.selectedItems.add(selectedItem);
      this.renamingItem = selectedItem;
      this.updateFileList();
    }
  }
  async deleteSelectedMultiple(files = [], path = null) {
    if (!path) path = this.context.path;
    if (files.length === 0) {
      const allFiles = fileSystem.ls(path);
      files = Array.from(this.selectedItems).map(name => allFiles.find((f) => f.name === name)).filter(Boolean) || [];
      if (files.length === 0) return;
    }

    const systemFiles = files.filter(f => f.parameters?.isSystem === true);
    if (systemFiles.length > 0) {
      new Dialog('File Explorer - Access Denied',
        `Cannot delete system item${systemFiles.length !== 1 ? 's' : ''}.`,
        (files.length !== 1 ? `${systemFiles.length === files.length ? 'All' : systemFiles.length} of the selected ${files.length} items are protected system file${systemFiles.length !== 1 ? 's' : ''}` : `The selected item is a protected system ${systemFiles[0].type === 'directory' ? 'directory' : 'file'}`) + ` and cannot be modified.`,
        'error', ['Ok'], 'Ok', this.app);
      return;
    }

    const answer = await new Dialog(
      'File Explorer - Confirm Deletion',
      `Are you sure you want to permanently delete ${files.length} item${files.length !== 1 ? 's' : ''}?`,
      `${files.length !== 1 ? 'These selected items' : 'The selected item'} will be permanently removed from the system and cannot be restored.`,
      'warning', ['Delete', 'Cancel'], 'Cancel', this.app
    );

    if (answer === 'Delete') {
      try {
        files.forEach(file => {
          fileSystem.rm(fileSystem.getResolvedPath(path, file.name)[0], true);
        });
        this.clearSelection();
        this.updateUI();
      } catch (e) {
        new Dialog('File Explorer - Error', 'An unexpected error occurred.', e.message, 'error', ['Ok'], 'Ok', this.app);
      }
    }
  }

  async deleteSelected(file = null, path = null, selectedItem = null) {
    if (!path) path = this.context.path;
    if (!file) file = fileSystem.ls(path).find((f) => f.name === selectedItem);
    if (!file) return;
    try {
      const itemName = file.name;
      if (!file) {
        new Dialog('File Explorer - Error',
          'Item not found.',
          `The item "${itemName}" does not exist at the current path.`,
          'error', ['Ok'], 'Ok', this.app);
        this.updateUI();
        return;
      }
      if (file.parameters.isSystem === true) {
        new Dialog('File Explorer - Access Denied',
          'Cannot delete system item.',
          `The item "${itemName}" is a protected system ${file.type === 'directory' ? 'directory' : 'file'} and cannot be modified.`,
          'error', ['Ok'], 'Ok', this.app);
        return;
      }
      const answer = await new Dialog(
        'File Explorer - Confirm Deletion',
        `Are you sure you want to permanently delete "${itemName}"?`,
        `This ${file.type === 'directory' ? 'directory' : 'file'} will be permanently removed from the system and cannot be restored.`,
        'warning', ['Delete', 'Cancel'], 'Cancel', this.app
      );
      if (answer === 'Delete') {
        fileSystem.rm(fileSystem.getResolvedPath(path, itemName)[0], true);
        this.updateUI();
      }
    } catch (e) {
      new Dialog('File Explorer - Error', 'An unexpected error occurred.', e.message, 'error', ['Ok'], 'Ok', this.app);
    }
  }
  async copyPath(path = null, selectedItem = null, customText = null) {
    try {
      let textToCopy = customText;
      if (!textToCopy) {
        if (selectedItem) textToCopy = fileSystem.getResolvedPath(path, selectedItem)[0];
        else textToCopy = path;
      }
      await copyText(textToCopy);
    } catch (e) {
      new Dialog('File Explorer - Error', 'An error occurred', e.message, 'error', ['Ok'], 'Ok', this.app);
    }
  }

  async unarchiveFile(file, savedPath) {
    const manager = new FileCopyManager();
    manager.setStatus('Unpacking files...');
    manager.sourceFile.textContent = file.name;
    manager.destPath.textContent = savedPath;
    try {
      const extractedFiles = await fileSystem.unarchive(file, (processed, total, currentFile) => {
        const displayFile = currentFile || file.name;
        manager.updateProgress(processed, total, displayFile, file.name, savedPath);
      });
      manager.setStatus('Processing extracted files...');
      let filesProcessed = 0;
      const totalFiles = extractedFiles.length;
      for (const item of extractedFiles) {
        if (item.isDirectory) {
          fileSystem.mkdirp(fileSystem.getResolvedPath(savedPath, item.path)[0]);
        } else {
          const newFilePath = fileSystem.getResolvedPath(savedPath, item.path)[0];
          fileSystem.mkdirp(newFilePath.split('/').slice(0, -1).join('/'));
          await fileSystem.writeFile(newFilePath, item.content, true);
        }
        filesProcessed++;
        manager.updateProgress(filesProcessed, totalFiles, item.path, file.name, savedPath);
      }
      manager.updateProgress(totalFiles, totalFiles, file.name, file.name, savedPath);
      manager.setSuccess();
      this.updateUI();
    } catch (e) {
      manager.setError(e.message);
    }
  }

  navigateTo(path) {
    try {
      const resolved = fileSystem._resolvePath(path);
      if (resolved && resolved.type === 'directory') {
        if (this.context.path !== path) {
          this.context.path = path;
          this.clearSelection();
        }
        this.updateFileList();
      }
    } catch (e) {
      console.error('Navigation error:', e);
    }
  }

  updateBreadcrumb() {
    if (!this.breadcrumbNav) return;
    const paths = this.context.path.split('/').filter(p => p);
    const breadcrumbHTML = [];
    breadcrumbHTML.push(`<span class="breadcrumb-item" data-path="/">root</span>`);
    let currentPath = '';
    paths.forEach((part, index) => {
      currentPath += '/' + part;
      const isLast = index === paths.length - 1;
      breadcrumbHTML.push(`<span class="breadcrumb-sep">›</span>`);
      breadcrumbHTML.push(`<span class="breadcrumb-item${isLast ? ' active' : ''}" data-path="${currentPath}">${part}</span>`);
    });
    breadcrumbHTML.push(`<span class="breadcrumb-sep">›</span>`);
    this.breadcrumbNav.innerHTML = breadcrumbHTML.join('');
    this.breadcrumbNav.querySelectorAll('.breadcrumb-item').forEach(item => {
      this.app.addTrackedListener(item, 'click', () => {
        const path = item.dataset.path;
        this.navigateTo(path);
      });
    });
  }

  updateStatusBar() {
    if (!this.statusBar) return;
    const files = fileSystem.ls(this.context.path);
    const itemsCount = files.length;
    const selectedCount = this.selectedItems.size;
    let totalSize = 0;
    files.forEach(file => {
      if (file.type === 'file' || file.type === "link")
        totalSize += fileSystem.getItemSize(file);
    });
    const itemsSpan = this.appMain.querySelector('.status-items-count');
    if (itemsSpan) itemsSpan.textContent = `${itemsCount} item${itemsCount !== 1 ? 's' : ''}`;
    const selectedSpan = this.appMain.querySelector('.status-selected-count');
    if (selectedSpan) {
      if (selectedCount > 0) {
        selectedSpan.textContent = `| ${selectedCount} selected`;
        selectedSpan.style.display = 'inline';
      } else {
        selectedSpan.style.display = 'none';
      }
    }
    const totalSpan = this.appMain.querySelector('.status-total-size');
    if (totalSpan) totalSpan.textContent = `${fileSystem.formatSize(totalSize)}`;
  }

  addBookmark(path) {
    const bookmarks = JSON.parse(StorageManager.getItem('fileExplorerBookmarks') || '[]');
    if (!bookmarks.includes(path)) {
      bookmarks.push(path);
      StorageManager.setItem('fileExplorerBookmarks', JSON.stringify(bookmarks));
      this.loadBookmarks();
    }
  }

  loadBookmarks() {
    const bookmarks = JSON.parse(StorageManager.getItem('fileExplorerBookmarks') || '[]');
    const bookmarksList = this.appMain.querySelector('#bookmarks-list');
    if (!bookmarksList) return;
    bookmarksList.innerHTML = '';
    bookmarks.forEach(path => {
      const item = document.createElement('div');
      item.className = 'sidebar-item bookmark-item';
      item.dataset.path = path;
      const name = path.split('/').pop() || path;
      item.innerHTML = `${icons.folder || '📁'} ${name} <span class="bookmark-remove" title="Remove">✕</span>`;
      this.app.addTrackedListener(item, 'click', (e) => {
        if (!e.target.closest('.bookmark-remove')) {
          this.navigateTo(path);
        }
      });
      this.app.addTrackedListener(item.querySelector('.bookmark-remove'), 'click', (e) => {
        e.stopPropagation();
        const updated = bookmarks.filter(b => b !== path);
        StorageManager.setItem('fileExplorerBookmarks', JSON.stringify(updated));
        this.loadBookmarks();
      });
      bookmarksList.appendChild(item);
    });
  }

  copySelected() {
    const paths = Array.from(this.selectedItems).map(name =>
      fileSystem.getResolvedPath(this.context.path, name)[0]
    );
    const clipboardData = { type: 'copy', paths, source: this.context.path };
    StorageManager.setItem('fileExplorerClipboard', JSON.stringify(clipboardData));
  }

  cutSelected() {
    const paths = Array.from(this.selectedItems).map(name =>
      fileSystem.getResolvedPath(this.context.path, name)[0]
    );
    const clipboardData = { type: 'cut', paths, source: this.context.path };
    StorageManager.setItem('fileExplorerClipboard', JSON.stringify(clipboardData));
  }

  pasteSelected() {
    try {
      const clipboardData = JSON.parse(StorageManager.getItem('fileExplorerClipboard') || 'null');
      if (!clipboardData || !clipboardData.paths || clipboardData.paths.length === 0) return;
      const { type, paths, source } = clipboardData;
      const errors = [];
      const successes = [];

      if (type === 'copy') {
        paths.forEach(sourcePath => {
          const fileName = sourcePath.split('/').pop();
          try {
            const targetPath = fileSystem.getResolvedPath(this.context.path, fileName)[0];
            fileSystem.cp(sourcePath, targetPath);
            successes.push(fileName);
          } catch (e) {
            errors.push({ file: fileName, error: e.message });
          }
        });
      } else if (type === 'cut') {
        paths.forEach(sourcePath => {
          const fileName = sourcePath.split('/').pop();
          try {
            const targetPath = fileSystem.getResolvedPath(this.context.path, fileName)[0];
            fileSystem.mv(sourcePath, targetPath);
            successes.push(fileName);
          } catch (e) {
            errors.push({ file: fileName, error: e.message });
          }
        });
        if (successes.length === paths.length) {
          StorageManager.removeItem('fileExplorerClipboard');
        }
      }

      if (errors.length > 0) {
        const errorList = errors.map(e => `<br>• ${e.file}: ${e.error}`).join('\n');
        new Dialog('File Explorer - Paste Errors',
          `${successes.length} of ${paths.length} items pasted successfully.`,
          `Errors:\n${errorList}`,
          'warning', ['Ok'], 'Ok', this.app);
      } else if (successes.length > 0) {
        this.addOutputLine?.(`Successfully ${type === 'copy' ? 'copied' : 'moved'} ${successes.length} item${successes.length !== 1 ? 's' : ''}`);
      }

      this.updateFileList();
    } catch (e) {
      console.error('Paste error:', e);
      new Dialog('File Explorer - Error', 'Paste operation failed', e.message, 'error', ['Ok'], 'Ok', this.app);
    }
  }

  selectAll() {
    const files = this.getSortedFiles();
    this.selectedItems.clear();
    this.ctrlSelectedItems.clear();
    files.forEach(file => {
      this.selectedItems.add(file.name);
    });
    this.updateFileList();
  }

  filterFiles(searchTerm) {
    const items = this.fileList.querySelectorAll('.file-item');
    const term = searchTerm.toLowerCase().trim();
    if (this.fileList.contains(this.noFilesFoundMessage)) {
      this.fileList.removeChild(this.noFilesFoundMessage);
    }
    items.forEach(item => {
      const name = item.dataset.name.toLowerCase();
      if (term === '' || name.includes(term) || term.includes(name)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });

    const visibleItems = Array.from(items).filter(i => i.style.display !== 'none').length;
    const totalItems = items.length;
    if (term !== '' && visibleItems === 0) {
      this.fileList.appendChild(this.noFilesFoundMessage);
    }
  }
}

class VideoPlayer {
  constructor(args = null, path = null) {
    path = path || args?.split(' -')[1] || null;
    this.app = new Modal("Video Player");
    this.appMain = this.app.appMain;
    this.app.setApp();
    this.app.setupInfoBtn('Video Player',
      'Video Player plays videos with playback, volume, scale, and speed controls. It also supports keyboard shortcuts like Space to toggle playback and F for fullscreen.'
    );
    this.video = document.createElement("video");
    this.controlsVisible = true;
    this.videoScales = [
      { name: "Fit", value: "contain" },
      { name: "Fill", value: "cover" },
      { name: "Stretch", value: "fill" }
    ];
    this.playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    this.zoomLevel = 100;
    this.zoomStep = 10;
    this.app.appMain.innerHTML = `
              <div class="video-container">
                  <div class="loading-spinner"></div>
                  <div class="play-pause-icon">${icons.pause}</div>
                  <div class="video-controls">
                    <div class="controls-top">
                      <span class="time-current">00:00</span>
                      <input type="range" class="progress" value="0">
                      <span class="time-end">00:00</span>
                    </div>
                    <div class="controls-bottom">
                      <button class="play-pause-btn">${icons.pause}</button>
                      <div class="volume-element">
                        <button class="volume-btn">${icons.volumeUp}</button>
                        <input type="range" class="volume" min="0" max="1" step="0.1" value="1">
                      </div>
                      <div class="settings-menu">
                        <button class="settings-btn">${icons.settings}</button>
                        <div class="settings-dropdown">
                            <div class="settings-header">Video Settings</div>
                            <div class="settings-item">
                                <label>Scale:</label>
                                <select class="video-scale">
                                    ${this.videoScales
        .map(
          (opt) =>
            `<option value="${opt.value}">${opt.name}</option>`
        )
        .join("")}
                                </select>
                            </div>
                            <div class="settings-item">
                                <label>Speed:</label>
                                <select class="playback-speed">
                                    ${this.playbackSpeeds
        .map(
          (speed) =>
            `<option value="${speed}" ${speed === 1 ? "selected" : ""
            }>${speed}x</option>`
        )
        .join("")}
                                </select>
                            </div>
                            <div class="settings-item">
                                <label>Zoom:</label>
                                <div class="zoom-controls">
                                    <button class="zoom-out">-</button>
                                    <span class="zoom-level">${this.zoomLevel
      }%</span>
                                    <button class="zoom-in">+</button>
                                </div>
                            </div>
                        </div>
                      </div>
                      <button class="fullscreen">${icons.fullscreen}</button>
                    </div>
                  </div>
              </div>
          `;
    this.videoContainer = this.appMain.querySelector(".video-container");
    this.videoContainer.insertBefore(this.video, this.videoContainer.firstChild);
    this.settingsBtn = this.appMain.querySelector(".settings-btn");
    this.settingsDropdown = this.appMain.querySelector(".settings-dropdown");
    this.videoScaleSelect = this.appMain.querySelector(".video-scale");
    this.playbackSpeedSelect = this.appMain.querySelector(".playback-speed");
    this.zoomOutBtn = this.appMain.querySelector(".zoom-out");
    this.zoomInBtn = this.appMain.querySelector(".zoom-in");
    this.zoomLevelDisplay = this.appMain.querySelector(".zoom-level");
    this.app.addTrackedListener(this.zoomOutBtn, "click", () =>
      this.adjustZoom(-this.zoomStep)
    );
    this.app.addTrackedListener(this.zoomInBtn, "click", () =>
      this.adjustZoom(this.zoomStep)
    );
    this.app.addTrackedListener(this.settingsBtn, "click", (e) => {
      e.stopPropagation();
      this.settingsDropdown.classList.toggle("visible");
    });
    this.app.addTrackedListener(this.videoScaleSelect, "change", () => {
      this.video.style.objectFit = this.videoScaleSelect.value;
    });
    this.app.addTrackedListener(this.playbackSpeedSelect, "change", () => {
      this.video.playbackRate = parseFloat(this.playbackSpeedSelect.value);
    });
    this.app.addTrackedListener(document, "click", (e) => {
      if (
        !this.settingsDropdown.contains(e.target) &&
        !this.settingsBtn.contains(e.target)
      ) {
        this.settingsDropdown.classList.remove("visible");
      }
    });
    this.video.controls = false;
    this.video.poster =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    this.app.addTrackedListener(this.video, "loadeddata", async () => {
      try {
        const savePlay = this.video.paused;
        await this.video.play();
        if (savePlay) this.video.pause();
      } catch { }
    });
    this.app.addTrackedListener(this.video, "error", (e) => {
      console.error("Video player: an error occurred");
    });
    this.app.addTrackedListener(this.videoContainer, 'fullscreenchange', () => {
      const orientation = screen?.orientation;
      if (!orientation) return;
      if (document.fullscreenElement) {
        if (typeof orientation.lock === 'function') {
          orientation.lock('landscape').catch(() => { });
        }
      } else {
        if (typeof orientation.unlock === 'function') {
          orientation.unlock();
        }
      }
    });
    this.playPauseBtn = this.appMain.querySelector(".play-pause-btn");
    this.progress = this.appMain.querySelector(".progress");
    this.volume = this.appMain.querySelector(".volume");
    this.volumeBtn = this.appMain.querySelector(".volume-btn");
    this.fullscreenBtn = this.appMain.querySelector(".fullscreen");
    this.timeCurrent = this.appMain.querySelector(".time-current");
    this.timeEnd = this.appMain.querySelector(".time-end");
    this.setupEvents();
    this.setLoading(true);
    this.app.setupExitBtn(() => this.video.pause());
    if (!path) {
      this.setLoading(false);
      this.noVideoError();
      return;
    }
    const name = path.split('/').pop();
    this.app.updateTitle(name + " - Video Player");
    fileSystem.asyncReadFile(path).then((content) => {
      return fileSystem.decodeContent(content, 'url');
    }).then((url) => {
      this.video.src = url;
      this.setupMediaSession(name);
    }).catch((error) => {
      alert("Error loading file: " + error.message);
      this.setLoading(false);
    });
  }
  async noVideoError() {
    await new Dialog('No Video', 'No video file specified', 'Please select a video file to play.', 'error', ['OK'], 'OK', this.app);
    this.app.handleClose();
  }
  setupMediaSession(name) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: name });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.music.pause();
      });
      navigator.mediaSession.setActionHandler('play', () => {
        this.music.play();
      });
    }
  }
  adjustZoom(amount) {
    this.zoomLevel = Math.min(Math.max(this.zoomLevel + amount, 10), 200);
    this.zoomLevelDisplay.textContent = `${this.zoomLevel}%`;
    this.video.style.transform = `scale(${this.zoomLevel / 100})`;
    this.video.style.transformOrigin = "center center";
  }
  setupEvents() {
    this.app.addTrackedListener(this.playPauseBtn, "click", () => this.togglePlayVideo());
    this.app.addTrackedListener(this.video, "timeupdate", () => {
      const percent = (this.video.currentTime / this.video.duration) * 100;
      this.progress.style.setProperty("--progress", percent + "%");
      this.progress.value = percent;
      this.updateTimeDisplay();
    });
    this.app.addTrackedListener(this.video, "waiting", () => this.setLoading(true));
    this.app.addTrackedListener(this.video, "playing", () => this.setLoading(false));
    this.app.addTrackedListener(this.video, "seeking", () => this.setLoading(true));
    this.app.addTrackedListener(this.video, "seeked", () => this.setLoading(false));
    this.app.addTrackedListener(this.video, "canplay", () => this.setLoading(false));
    this.app.addTrackedListener(this.video, "stalled", () => this.setLoading(true));
    this.app.addTrackedListener(this.video, "error", () => this.setLoading(false));

    this.app.addTrackedListener(this.progress, "input", (e) => {
      try {
        const time = (e.target.value / 100) * this.video.duration;
        this.video.currentTime = time;
      } catch { }
    });
    this.app.addTrackedListener(this.volumeBtn, "click", () => this.updateVolume(this.video.muted ? this.video.volume : 0));
    this.app.addTrackedListener(this.volume, "input", (e) => this.updateVolume(e.target.value));
    this.app.addTrackedListener(this.fullscreenBtn, "click", () => {
      this.toggleFullscreen();
    });
    this.app.addTrackedListener(window, "keydown", (e) => {
      if (!this.app.modWindow.classList.contains("active")) return;
      this.resetTimeControls();
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          this.video.currentTime += 5;
          break;
        case "ArrowLeft":
          e.preventDefault();
          this.video.currentTime -= 5;
          break;
        default:
          if (e.code === "KeyF") {
            e.preventDefault();
            this.toggleFullscreen();
          } else if (e.code === "Space") {
            e.preventDefault();
            this.togglePlayVideo();
          }
          break;
      }
    });
    this.mouseTimeout = null;
    this.app.addTrackedListener(this.app.modWindow, "click", (e) => this.resetTimeControls());
    this.app.addTrackedListener(this.video, "click", (e) => this.togglePlayVideo());
    this.app.addTrackedListener(this.videoContainer, "mousemove", () => this.resetTimeControls());
    this.app.addTrackedListener(this.video, "dblclick", () => this.toggleFullscreen());
    this.app.addTrackedListener(this.video, "play", () => {
      this.videoContainer.classList.add("playing");
      this.playPauseBtn.innerHTML = icons.play;
    });
    this.app.addTrackedListener(this.video, "pause", () => {
      this.videoContainer.classList.remove("playing");
      this.playPauseBtn.innerHTML = icons.pause;
      this.resetTimeControls();
    });
  }
  updateVolume(v) {
    this.volume.value = v;
    this.volume.style.setProperty("--progress", v * 100 + "%");
    if (v <= 0) this.video.muted = true;
    else {
      this.video.volume = v;
      if (this.video.muted) this.video.muted = false;
    }
    if (v <= 0) {
      this.volumeBtn.innerHTML = icons.volumeMute;
    } else if (v <= 0.5) {
      this.volumeBtn.innerHTML = icons.volumeDown;
    } else {
      this.volumeBtn.innerHTML = icons.volumeUp;
    }
  }
  resetTimeControls() {
    if (this.mouseTimeout) clearTimeout(this.mouseTimeout);
    this.mouseTimeout = setTimeout(() => this.hideControls(), 3000);
    setTimeout(() => this.showControls(), 10);
  }
  async togglePlayVideo() {
    try {
      this.video.paused ? await this.video.play() : await this.video.pause();
    } catch {
      this.videoContainer.classList[this.video.paused ? "remove" : "add"]("playing");
    }
  }
  setLoading(isLoading) {
    this.videoContainer.classList[isLoading ? "add" : "remove"]("loading");
  }
  updateTimeDisplay() {
    const formatTime = (seconds) => {
      if (isNaN(seconds) || seconds < 0) return '00:00';
      let secs = Math.floor(seconds);
      const hours = Math.floor(secs / 3600);
      secs %= 3600;
      const mins = Math.floor(secs / 60);
      secs %= 60;
      const parts = [];
      if (hours > 0) {
        parts.push(hours.toString().padStart(2, "0"));
      }
      parts.push(mins.toString().padStart(2, "0"));
      parts.push(secs.toString().padStart(2, "0"));
      return parts.join(":");
    };
    this.timeCurrent.textContent = formatTime(this.video.currentTime);
    this.timeEnd.textContent = formatTime(this.video.duration);
  }

  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().then(() => { this.fullscreenBtn.innerHTML = icons.fullscreen; }).catch((e) => { });
    } else {
      this.videoContainer.requestFullscreen?.().then(() => { this.fullscreenBtn.innerHTML = icons.minFullscreen; }).catch((e) => { });
    }
  }
  showControls() {
    if (!this.controlsVisible) {
      const controls = this.appMain.querySelector(".video-controls");
      controls.style.opacity = "1";
      this.controlsVisible = true;
      if (this.eventsTimer) clearTimeout(this.eventsTimer);
      this.eventsTimer = setTimeout(() => (controls.style.pointerEvents = "all"), 200);
    }
  }
  hideControls() {
    if (this.controlsVisible && !this.video.paused) {
      const controls = this.appMain.querySelector(".video-controls");
      controls.style.opacity = "0";
      this.controlsVisible = false;
      if (this.eventsTimer) clearTimeout(this.eventsTimer);
      this.eventsTimer = setTimeout(() => (controls.style.pointerEvents = "none"), 200);
      if (this.mouseTimeout) clearTimeout(this.mouseTimeout);
      this.mouseTimeout = null;
    }
  }
}

class AudioPlayer {
  constructor(args = null, path = null) {
    path = path || args?.split(' -')[1] || null;
    this.app = new Modal("Audio Player");
    this.appMain = this.app.appMain;
    this.app.setupExitBtn();
    this.app.setApp();
    this.app.setupInfoBtn('Audio Player',
      'Audio Player plays music files with simple playback, volume, and progress controls, making it easy to listen to audio from the file system.'
    );
    this.isPlaying = false;
    this.createPlayerUI();
    this.setupEventListeners();
    if (!path) {
      this.noAudioError();
      return;
    }
    const name = path.split('/').pop();
    this.app.updateTitle(name + " - Audio Player");
    fileSystem.asyncReadFile(path).then((content) => {
      return fileSystem.decodeContent(content, 'url');
    }).then((url) => {
      this.music.src = url;
      this.setupMediaSession(name);
      this.appMain.querySelector('.audio-title').textContent = name;
    }).catch((error) => {
      console.error("Error loading file:", error.message);
    });
  }
  noAudioError() {
    new Dialog('No Audio', 'No audio file specified', 'Please select an audio file to play.', 'error', ['OK'], 'OK', this.app).then(() => {
      this.app.handleClose();
    });
  }
  createPlayerUI() {
    this.appMain.innerHTML = `
      <div class="audio-player">
        <div class="audio-element">
          <div class="audio-info">
            <h2 class="audio-title">Loading...</h2>
          </div>
          <div class="progress-container">
            <div class="time-display">
              <span class="current-time">00:00</span>
              <span class="total-time">00:00</span>
            </div>
            <input type="range" class="progress" value="0">
          </div>
          <div class="audio-controls">
            <button class="control-btn play-btn">
              <svg viewBox="0 0 24 24" fill="currentColor" id="play-icon">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <div class="volume-element">
              <button class="volume-btn">${icons.volumeUp}</button>
              <input type="range" class="volume" min="0" max="1" step="0.1" value="1">
            </div>
          </div>
        </div>
        <audio class="audio-element-native"></audio>
      </div>
    `;
    this.music = this.appMain.querySelector('.audio-element-native');
    this.playBtn = this.appMain.querySelector('.play-btn');
    this.playIcon = this.appMain.querySelector('#play-icon');
    this.volumeBtn = this.appMain.querySelector('.volume-btn');
    this.volume = this.appMain.querySelector('.volume');
    this.progress = this.appMain.querySelector(".progress");
    this.currentTimeDisplay = this.appMain.querySelector('.current-time');
    this.totalTimeDisplay = this.appMain.querySelector('.total-time');
    this.updateVolumeButton();
  }
  setupEventListeners() {
    this.app.addTrackedListener(this.playBtn, 'click', () => this.togglePlay());
    this.app.addTrackedListener(this.volumeBtn, "click", () => this.updateVolume(this.music.muted ? this.music.volume : 0));
    this.app.addTrackedListener(this.volume, "input", (e) => this.updateVolume(e.target.value));
    this.app.addTrackedListener(this.music, 'loadedmetadata', () => {
      this.updateTimeDisplay();
    });
    this.app.addTrackedListener(this.music, 'timeupdate', () => {
      if (this.music.duration) {
        const percent = (this.music.currentTime / this.music.duration) * 100;
        this.progress.style.setProperty("--progress", percent + "%");
        this.progress.value = percent;
      }
      this.updateTimeDisplay();
    });
    this.app.addTrackedListener(this.progress, "input", (e) => {
      try {
        this.music.currentTime = (e.target.value / 100) * this.music.duration;
      } catch { }
    });
    this.app.addTrackedListener(this.music, 'play', () => {
      this.updatePlay(true);
    });
    this.app.addTrackedListener(this.music, 'pause', () => {
      this.updatePlay(false);
    });
    this.app.addTrackedListener(this.music, 'ended', () => {
      this.updatePlay(false);
    });
    this.app.addTrackedListener(this.music, 'volumechange', () => {
      this.updateVolumeButton();
    });

    this.app.addTrackedListener(this.app.modWindow, 'keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      }
    });
  }

  togglePlay() {
    if (this.isPlaying) {
      this.music.pause();
    } else {
      this.music.play().catch(e => console.log('Play failed:', e.message));
    }
  }
  updatePlay(isPlay) {
    this.isPlaying = isPlay;
    this.playIcon.innerHTML = this.isPlaying ? icons.play : icons.pause;
  }
  updateVolume(v) {
    this.volume.value = v;
    this.volume.style.setProperty("--progress", v * 100 + "%");
    if (v <= 0) this.music.muted = true;
    else {
      this.music.volume = v;
      if (this.music.muted) this.music.muted = false;
    }
  }
  updateVolumeButton() {
    const v = this.music.muted ? 0 : this.music.volume;
    if (v <= 0) {
      this.volumeBtn.innerHTML = icons.volumeMute;
    } else if (v <= 0.5) {
      this.volumeBtn.innerHTML = icons.volumeDown;
    } else {
      this.volumeBtn.innerHTML = icons.volumeUp;
    }
  }
  updateTimeDisplay() {
    const formatTime = (seconds) => {
      if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    this.currentTimeDisplay.textContent = formatTime(this.music.currentTime);
    this.totalTimeDisplay.textContent = formatTime(this.music.duration);
  }
  setupMediaSession(name) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: name
      });
      navigator.mediaSession.setActionHandler('play', () => this.music.play());
      navigator.mediaSession.setActionHandler('pause', () => this.music.pause());
    }
  }
}

class Browser {
  constructor(args = null, path = null) {
    path = path || args?.split(' -')[1] || null;
    this.app = new Modal("Browser");
    this.appMain = this.app.appMain;
    this.iframe = document.createElement('iframe');
    this.iframe.className = 'browser-iframe';
    this.appMain.appendChild(this.iframe);
    this.app.setupExitBtn();
    this.app.setApp();
    this.app.setupInfoBtn('Browser',
      'Browser opens HTML files in a safe embedded view so you can preview page content directly from the virtual filesystem.'
    );
    if (path) {
      const name = path.split('/').pop();
      this.app.updateTitle(name + " - Browser");
      fileSystem.asyncReadFile(path).then((content) => {
        return fileSystem.decodeContent(content, 'text');
      }).then((html) => {
        this.updateViewer(html);
      }).catch((error) => {
        console.error("Error loading file:", error.message);
      });
    } else {
      new Dialog('Browser - Error', 'No file specified', 'The Browser app requires a file path to open. Please select an HTML file from the file explorer to view it in the browser.', 'error', ['Ok'], 'Ok', this.app);
    }
  }
  updateViewer(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    this.iframe.srcdoc = doc.documentElement.outerHTML;
  }
}

class TaskManager {
  constructor(args = null, path = null) {
    this.app = new Modal("Task Manager");
    this.app.setApp();
    this.app.setupInfoBtn('Task Manager',
      'Task Manager shows running apps, process status, and browser power info so you can inspect or stop tasks.'
    );
    this.appMain = this.app.appMain;
    this.appMain.classList.add("task-manager");
    this.selectedApp = null;
    this.sortBy = "name";
    this.expandedApps = new Set();
    this.contextMenu = null;
    this.webglSupported = this.checkWebGLSupport();
    this.initUI();
    this.refreshInterval = setInterval(() => this.updateProcessList(), 1000);
    this.infoInterval = setInterval(() => this.updateBrowserInfo(), 1000);
    this.app.setupExitBtn(() => {
      clearInterval(this.refreshInterval);
      clearInterval(this.infoInterval);
    });
  }

  checkWebGLSupport() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      const supported = !!gl;
      if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
      canvas.remove();
      return supported;
    } catch {
      return false;
    }
  }

  initUI() {
    this.appMain.innerHTML = `
      <div class="tm-tabs">
        <div class="tm-tab active" data-tab="applications">Applications</div>
        <div class="tm-tab" data-tab="services">Services</div>
        <div class="tm-tab" data-tab="browser-info">Power Info</div>
      </div>
      <div class="tm-content">
        <div class="tm-tab-content active" id="applications-tab">
          <div class="tm-list-main">
            <div class="tm-list-header">
              <div class="tm-col-name">Application Name</div>
              <div class="tm-col-status">Status</div>
              <div class="tm-col-type">Type</div>
            </div>
            <div class="tm-process-list" id="applications-list"></div>
          </div>
          <div class="tm-buttons">
            <button class="tm-btn" id="endTask">End Task</button>
          </div>
        </div>
        <div class="tm-tab-content" id="services-tab">
          <div class="tm-services-info">No services available</div>
        </div>
        <div class="tm-tab-content" id="browser-info-tab">
          <div class="tm-info-grid" id="browser-info-grid"></div>
        </div>
      </div>
    `;

    this.setupTabListeners();
    this.setupButtonListeners();
    this.setupLongPressMenu();
    this.updateProcessList();
    this.updateBrowserInfo();
  }

  setupTabListeners() {
    const tabs = this.appMain.querySelectorAll(".tm-tab");
    tabs.forEach(tab => {
      this.app.addTrackedListener(tab, "click", (e) => {
        tabs.forEach(t => t.classList.remove("active"));
        const contents = this.appMain.querySelectorAll(".tm-tab-content");
        contents.forEach(c => c.classList.remove("active"));

        e.target.classList.add("active");
        const tabName = e.target.dataset.tab;
        this.appMain.querySelector(`#${tabName}-tab`).classList.add("active");
      });
    });
  }

  setupButtonListeners() {
    const endTaskBtn = this.appMain.querySelector("#endTask");
    this.app.addTrackedListener(endTaskBtn, "click", () => this.endSelectedTask());
  }

  setupLongPressMenu() {
    let longPressTimer = null;
    let longPressTarget = null;
    let touchStartEvent = null;
    const container = this.appMain.querySelector('.tm-process-list');
    if (!container) return;

    const startLongPress = (e) => {
      longPressTarget = e.target.closest('.tm-process-item');
      touchStartEvent = e;
      longPressTimer = setTimeout(() => {
        if (longPressTarget) {
          this.clearSelection();
          longPressTarget.classList.add('selected');
          const rootIndex = parseInt(longPressTarget.dataset.index ?? longPressTarget.dataset.parentIndex);
          const childIndex = longPressTarget.dataset.childIndex !== undefined ? parseInt(longPressTarget.dataset.childIndex) : null;
          this.selectedApp = childIndex !== null && !Number.isNaN(childIndex) ? { rootIndex, childIndex } : { rootIndex };
        } else {
          this.clearSelection();
        }

        const touch = touchStartEvent.touches[0];
        const synthEvent = new MouseEvent('contextmenu', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          pageX: touch.pageX,
          pageY: touch.pageY,
          bubbles: true,
          cancelable: true
        });
        synthEvent.isLongPress = true;
        const dispatchTarget = longPressTarget || container;
        dispatchTarget.dispatchEvent(synthEvent);
      }, 500);
    };

    const endLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      longPressTarget = null;
      touchStartEvent = null;
    };

    this.app.addTrackedListener(container, 'touchstart', startLongPress, { passive: true });
    this.app.addTrackedListener(container, 'touchend', endLongPress);
    this.app.addTrackedListener(container, 'touchmove', endLongPress);
    this.app.addTrackedListener(container, 'touchcancel', endLongPress);
  }

  getApplications() {
    return window.openApplications.filter(app =>
      app && app.modWindow && app.modWindow.parentElement && !app.parentApp
    );
  }

  updateProcessList() {
    const appsList = this.appMain.querySelector("#applications-list");
    if (appsList) {
      const rootApps = this.getApplications();
      const newHtml = this.renderProcessTree(rootApps) ||
        '<div class="tm-empty">No running applications</div>';
      if (appsList.innerHTML !== newHtml) {
        appsList.innerHTML = newHtml;
        this.attachProcessListeners(appsList);
      }
    }
  }

  async getBrowserBatteryInfo() {
    if (!navigator.getBattery) {
      return {
        supported: false
      };
    }
    try {
      const battery = await navigator.getBattery();
      return {
        supported: true,
        level: Math.round(battery.level * 100),
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime
      };
    } catch {
      return {
        supported: false
      };
    }
  }

  async getBrowserInfo() {
    const battery = await this.getBrowserBatteryInfo();
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    const currentTime = new Date();
    const orientation = screen.orientation?.type || (screen.width > screen.height ? 'landscape' : 'portrait');
    return {
      currentTime: currentTime.toLocaleString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown',
      online: navigator.onLine ? 'Yes' : 'No',
      connectionType: connection?.effectiveType || connection?.type || 'Unknown',
      downlink: connection?.downlink ? `${connection.downlink} Mbps` : 'Unknown',
      cores: navigator.hardwareConcurrency || 'Unknown',
      memory: navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'Unknown',
      webgl: this.webglSupported ? 'Supported' : 'Unavailable',
      resolution: `${window.screen.width}×${window.screen.height}`,
      orientation,
      battery
    };
  }

  renderBrowserInfo(info) {
    const batteryStatus = info.battery.supported
      ? `${info.battery.level}% · ${info.battery.charging ? 'Charging' : 'Discharging'}`
      : 'Not supported';
    const batteryDetails = info.battery.supported
      ? `
          <div class="tm-info-item">
            <span class="tm-info-key">Time ${info.battery.charging ? 'to full' : 'remaining'}</span>
            <span class="tm-info-value">${info.battery.charging ? (info.battery.chargingTime === Infinity ? 'Unknown' : `${Math.ceil(info.battery.chargingTime / 60)} min`) : (info.battery.dischargingTime === Infinity ? 'Unknown' : `${Math.ceil(info.battery.dischargingTime / 60)} min`)}</span>
          </div>
        `
      : '';

    return `
      <div class="tm-info-grid">
        <div class="tm-info-section">
          <div class="tm-info-title">Date & Time</div>
          <div class="tm-info-item">
            <span class="tm-info-key">Current time</span>
            <span class="tm-info-value">${info.currentTime}</span>
          </div>
          <div class="tm-info-item">
            <span class="tm-info-key">Timezone</span>
            <span class="tm-info-value">${info.timezone}</span>
          </div>
        </div>

        <div class="tm-info-section">
          <div class="tm-info-title">Battery</div>
          <div class="tm-info-item">
            <span class="tm-info-key">Level</span>
            <span class="tm-info-value">${batteryStatus}</span>
          </div>
          ${batteryDetails}
        </div>

        <div class="tm-info-section">
          <div class="tm-info-title">Network</div>
          <div class="tm-info-item">
            <span class="tm-info-key">Online</span>
            <span class="tm-info-value">${info.online}</span>
          </div>
          <div class="tm-info-item">
            <span class="tm-info-key">Connection</span>
            <span class="tm-info-value">${info.connectionType}</span>
          </div>
          <div class="tm-info-item">
            <span class="tm-info-key">Speed</span>
            <span class="tm-info-value">${info.downlink}</span>
          </div>
        </div>

        <div class="tm-info-section">
          <div class="tm-info-title">Browser Capabilities</div>
          <div class="tm-info-item">
            <span class="tm-info-key">CPU cores</span>
            <span class="tm-info-value">${info.cores}</span>
          </div>
          <div class="tm-info-item">
            <span class="tm-info-key">Memory</span>
            <span class="tm-info-value">${info.memory}</span>
          </div>
          <div class="tm-info-item">
            <span class="tm-info-key">WebGL</span>
            <span class="tm-info-value">${info.webgl}</span>
          </div>
        </div>

        <div class="tm-info-section">
          <div class="tm-info-title">Screen</div>
          <div class="tm-info-item">
            <span class="tm-info-key">Resolution</span>
            <span class="tm-info-value">${info.resolution}</span>
          </div>
          <div class="tm-info-item">
            <span class="tm-info-key">Orientation</span>
            <span class="tm-info-value">${info.orientation}</span>
          </div>
        </div>
      </div>
    `;
  }

  async updateBrowserInfo() {
    const browserTab = this.appMain.querySelector('#browser-info-grid');
    if (!browserTab) return;
    const info = await this.getBrowserInfo();
    const newHtml = this.renderBrowserInfo(info);
    if (browserTab.innerHTML !== newHtml) {
      browserTab.innerHTML = newHtml;
    }
  }

  renderProcessTree(apps) {
    return apps.map((app, index) => {
      const isActive = app.modWindow && app.modWindow.classList.contains("active");
      const hasChildren = app.childApps && app.childApps.length > 0;
      const isExpanded = this.expandedApps.has(app);

      let status, type;
      status = app.isMinimized ? "Minimized" : (isActive ? "Active" : app.isBlocked ? "Blocked" : "Inactive");
      type = app.constructor.name || "Application";

      const rootSelected = this.selectedApp && this.selectedApp.rootIndex === index && this.selectedApp.childIndex == null;
      return `
        <div class="tm-process-item ${rootSelected ? "selected" : ""}" data-index="${index}" data-parent="root" data-child="false">
          <div class="tm-col-name">
            ${hasChildren ? `<span class="tm-expand-btn" data-expand="${!isExpanded}">›</span>` : '<span class="tm-spacer"></span>'}
            ${app.appName}
            ${hasChildren ? `<span class="tm-child-count">[${app.childApps.length}]</span>` : ''}
          </div>
          <div class="tm-col-status">${status}</div>
          <div class="tm-col-type">${type}</div>
        </div>
        ${isExpanded && app.childApps ? app.childApps.map((child, childIndex) => {
        const childStatus = child.isMinimized ? "Minimized" : (child.modWindow && child.modWindow.classList.contains("active") ? "Active" : child.isBlocked ? "Blocked" : "Inactive");
        const childType = "Dialog";
        const childSelected = this.selectedApp && this.selectedApp.rootIndex === index && this.selectedApp.childIndex === childIndex;
        return `
            <div class="tm-process-item tm-child-process ${childSelected ? "selected" : ""}" data-parent-index="${index}" data-child-index="${childIndex}" data-child="true">
              <div class="tm-col-name">
                <span class="tm-child-indent">└─</span>
                ${child.appName}
              </div>
              <div class="tm-col-status">${childStatus}</div>
              <div class="tm-col-type">${childType}</div>
            </div>
          `;
      }).join('') : ''}
      `;
    }).join("");
  }

  attachProcessListeners(container) {
    const expandBtns = container.querySelectorAll(".tm-expand-btn");
    expandBtns.forEach(btn => {
      this.app.addTrackedListener(btn, "click", (e) => {
        e.stopPropagation();
        const item = btn.closest(".tm-process-item");
        const index = parseInt(item.dataset.index);
        const apps = this.getApplications();
        const app = apps[index];

        if (this.expandedApps.has(app)) {
          this.expandedApps.delete(app);
        } else {
          this.expandedApps.add(app);
        }
        this.updateProcessList();
      });
    });

    const items = container.querySelectorAll(".tm-process-item");
    items.forEach(item => {
      this.app.addTrackedListener(item, "click", (e) => {
        if (e.target.classList.contains("tm-expand-btn")) return;

        this.clearSelection();
        item.classList.add("selected");

        const rootIndex = parseInt(item.dataset.index ?? item.dataset.parentIndex);
        const childIndex = item.dataset.childIndex !== undefined ? parseInt(item.dataset.childIndex) : null;
        this.selectedApp = childIndex !== null && !Number.isNaN(childIndex) ? { rootIndex, childIndex } : { rootIndex };
      });

      this.app.addTrackedListener(item, "dblclick", (e) => {
        if (e.target.classList.contains("tm-expand-btn")) return;
        const rootIndex = parseInt(item.dataset.index ?? item.dataset.parentIndex);
        const childIndex = item.dataset.childIndex !== undefined ? parseInt(item.dataset.childIndex) : null;
        const app = this.getApplications()[rootIndex];
        const targetApp = childIndex !== null && app?.childApps ? app.childApps[childIndex] : app;
        if (targetApp && targetApp.modWindow) {
          targetApp.setActiveWindow();
        }
      });

      this.app.addTrackedListener(item, "contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.isLongPress && (e.pointerType === 'touch' || e.type.startsWith('touch'))) return;
        this.showContextMenu(e, item);
      });
    });

    this.app.addTrackedListener(container, "click", (e) => {
      if (!e.target.closest('.tm-process-item')) {
        this.clearSelection();
      }
    });
    this.app.addTrackedListener(container, "contextmenu", (e) => {
      if (e.target.closest('.tm-process-item')) return;
      e.preventDefault();
      e.stopPropagation();
      if (!e.isLongPress && (e.pointerType === 'touch' || e.type.startsWith('touch'))) return;
      this.clearSelection();
      this.showBackgroundContextMenu(e);
    });
  }

  clearSelection() {
    this.appMain.querySelectorAll(".tm-process-item").forEach(i => i.classList.remove("selected"));
    this.selectedApp = null;
  }

  showContextMenu(e, item) {
    if (this.contextMenu) this.contextMenu.remove();
    const rootIndex = parseInt(item.dataset.index ?? item.dataset.parentIndex);
    const childIndex = item.dataset.childIndex !== undefined ? parseInt(item.dataset.childIndex) : null;
    const apps = this.getApplications();
    const app = apps[rootIndex];
    const targetApp = childIndex !== null && app?.childApps ? app.childApps[childIndex] : app;
    if (!targetApp) return;

    this.clearSelection();
    item.classList.add("selected");
    this.selectedApp = childIndex !== null && !Number.isNaN(childIndex) ? { rootIndex, childIndex } : { rootIndex };

    const isRootItem = item.dataset.child === "false";
    const rootHasChildren = isRootItem && app?.childApps && app.childApps.length > 0;
    const isExpanded = rootHasChildren && this.expandedApps.has(app);

    this.contextMenu = document.createElement("div");
    this.contextMenu.className = "context-menu";

    let html = `
      <div class="menu-item open">Activate</div>
      <div class="menu-item end">End Task</div>
    `;
    if (rootHasChildren) {
      html += `
        <div class="menu-item ${isExpanded ? 'collapse' : 'expand'}">${isExpanded ? 'Collapse' : 'Expand'}</div>
      `;
    }
    html += `
      <div class="menu-item refresh">Refresh List</div>
    `;

    this.contextMenu.innerHTML = html;
    this.appMain.appendChild(this.contextMenu);

    const closeMenu = () => {
      this.contextMenu?.remove();
      this.contextMenu = null;
    };

    const activateItem = () => {
      if (targetApp && targetApp.modWindow) targetApp.setActiveWindow();
      closeMenu();
    };
    const endItem = () => {
      this.closeAppAndChildren(targetApp);
      this.clearSelection();
      this.updateProcessList();
      closeMenu();
    };
    const toggleExpand = () => {
      if (!rootHasChildren) return;
      if (isExpanded) this.expandedApps.delete(app);
      else this.expandedApps.add(app);
      this.updateProcessList();
      closeMenu();
    };
    const refreshList = () => {
      this.updateProcessList();
      closeMenu();
    };

    this.contextMenu.querySelector('.open').onclick = activateItem;
    this.contextMenu.querySelector('.end').onclick = endItem;
    if (rootHasChildren) this.contextMenu.querySelector(isExpanded ? '.collapse' : '.expand').onclick = toggleExpand;
    this.contextMenu.querySelector('.refresh').onclick = refreshList;

    const rect = this.app.modWindow.getBoundingClientRect();
    const x = Math.max(10, Math.min(e.pageX - rect.left - window.scrollX, rect.width - this.contextMenu.offsetWidth));
    const y = Math.max(10, Math.min(e.pageY - rect.top - window.scrollY, rect.height - this.contextMenu.offsetHeight));
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;

    this.app.addTrackedListener(document, "click", (e) => {
      if (!e.target.closest(".context-menu")) closeMenu();
    }, { once: true });
  }

  showBackgroundContextMenu(e) {
    if (this.contextMenu) this.contextMenu.remove();
    this.contextMenu = document.createElement("div");
    this.contextMenu.className = "context-menu";
    this.contextMenu.innerHTML = `<div class="menu-item refresh">Refresh List</div>`;
    this.appMain.appendChild(this.contextMenu);

    const closeMenu = () => {
      this.contextMenu?.remove();
      this.contextMenu = null;
    };

    this.contextMenu.querySelector('.refresh').onclick = () => {
      this.updateProcessList();
      closeMenu();
    };

    const rect = this.app.modWindow.getBoundingClientRect();
    const x = Math.max(10, Math.min(e.pageX - rect.left - window.scrollX, rect.width - this.contextMenu.offsetWidth));
    const y = Math.max(10, Math.min(e.pageY - rect.top - window.scrollY, rect.height - this.contextMenu.offsetHeight));
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;

    this.app.addTrackedListener(document, "click", (e) => {
      if (!e.target.closest(".context-menu")) closeMenu();
    }, { once: true });
  }

  closeAppAndChildren(app) {
    if (!app) return;
    if (Array.isArray(app.childApps) && app.childApps.length > 0) {
      [...app.childApps].forEach(child => this.closeAppAndChildren(child));
    }
    if (app.parentApp) {
      const idx = app.parentApp.childApps.indexOf(app);
      if (idx > -1) app.parentApp.childApps.splice(idx, 1);
      if (app.parentApp.childApps && app.parentApp.childApps.length === 0) app.parentApp.unblockWindow();
      app.parentApp = null;
    }
    app.childApps = [];
    if (app.modWindow) {
      app.handleClose();
    }
  }

  endSelectedTask() {
    if (this.selectedApp !== null) {
      const apps = this.getApplications();
      const rootIndex = this.selectedApp.rootIndex;
      const childIndex = this.selectedApp?.childIndex ?? null;
      const app = apps[rootIndex];
      const targetApp = childIndex !== null && app?.childApps ? app.childApps[childIndex] : app;
      if (targetApp && targetApp.modWindow) {
        this.closeAppAndChildren(targetApp);
        this.clearSelection();
        this.updateProcessList();
      }
    }
  }
}

async function executeFile(path, args = null) {
  const isAsk = !path.split('/').pop().toLowerCase().endsWith('.app');
  let answer = null;
  if (isAsk) {
    answer = await new Dialog('Confirm Execution', 'Security Risk', 'Executing code is dangerous. It can steal data or damage the system.\nOnly run if you trust the source.', 'warning', ['Cancel', 'Run'], 'Cancel');
    console.log("User confirmed execution. Running script...");
  }
  if (!isAsk || answer === 'Run') {
    try {
      (async function () {
        fileSystem.asyncReadFile(path).then((content) => { return fileSystem.decodeContent(content, 'text'); }).then((content) => {
          try {
            eval(content);
          } catch (e) {
            console.error(`Error executing file: ${e.message}`, e);
            new Dialog('Execution Error', 'An error occurred', e.message, 'error', ['OK'], 'OK');
          }
        }).catch((error) => {
          new Dialog('Read Error', 'Failed to read file', error.message, 'error', ['OK'], 'OK');
        });
      })();
    } catch (e) {
      console.error('Execution error:', e.message);
    }
  };
}
