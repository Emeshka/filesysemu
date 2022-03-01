module.exports = class FileElement {
    getExtension(dbEntry) {
        if (this.dbEntry.is_file) {
            let index = this.dbEntry.dir_name.lastIndexOf('.')
            return (index > 0) ? this.dbEntry.dir_name.substring(index + 1).toLowerCase() : ''
        } else return '';
    }

    addFiles() {
        let options = {
            title: "Добавить ссылки на файлы",
            defaultPath: lastOpenFileDialogFolder || app.getPath('documents') || app.getPath('home') || ".",
            buttonLabel: "Добавить",
            filters:[
                {name: 'Картинки', extensions: ['jpg', 'jpeg', 'jfif', 'svg', 'png', 'gif', 'webp', 'bmp']},
                {name: 'Документы', extensions: ['txt', 'doc', 'docx', 'odt', 'ppt', 'pptx', 'rtf', 'pdf',
                    'djvu', 'epub', 'fb2', 'htm', 'html', 'xls', 'xlsx', 'csv', 'xml', 'mhtml', 'sqlite3db']},
                {name: 'Видео', extensions: ['mkv', 'avi', 'mp4']},
                {name: 'Аудио', extensions: ['mp3', 'wav', 'ogg', 'flac']},
                {name: 'Все файлы', extensions: ['*']}
            ],
            properties: ['openFile', "multiSelections"]
        }
        dialog.showOpenDialog(WIN, options).then(result => {
            let filenames = result.filePaths;
            if (filenames.length < 1 || filenames.length == 1 && filenames[0] == '') {
                console.log('No filename. No files were added.');
                return;
            }
            lastOpenFileDialogFolder = filenames[0].substring(0, filenames[0].lastIndexOf(path.sep))
            let completeCounter = 0;
            let preparedRows = [];

            function callbackOnEveryInserted() {
                if (completeCounter < filenames.length) return;
                console.log('Every INSERT complete.')// Added rows:preparedRows

                openedDirectory.children_id_list = (openedDirectory.children_id_list == '' ? '' : openedDirectory.children_id_list+'\n')
                    + preparedRows.map(obj => obj.dir_id).join('\n');
                openedDirectory.updated_timestamp = unixTimestamp();
                //console.log('openedDirectory: ', openedDirectory)

                db.run(`UPDATE tree SET children_id_list='${openedDirectory.children_id_list}', updated_timestamp=
                    ${openedDirectory.updated_timestamp} WHERE dir_id='${openedDirectory.dir_id}'`, function(err) {try {
                    if (err) {
                        console.log(err);
                        dialog.showMessageBox(WIN, {
                            title: "Ошибка",
                            message: "При добавлении элементов в папку " + openedDirectory.dir_name
                            + " произошла ошибка. Запустите проверку ошибок на текущей открытой папке.",
                            buttons: ["OK"],
                            defaultId: 0
                        })
                    } else {
                        itemContainer.textContent = ''
                        itemByChildId = {};
                        selectedElements = [];
                        lastClickedElement = null;
                        contextMenuOpened = false;
                        flagFreeSelectionModeOn = false;
                        children = children.concat(preparedRows)
                        children.sort(rowComparators.nameAlphabeticalAscending)
                        for (let i = 0; i<children.length; i++) {
                            createItemTileView(children[i])
                        }
                    }
                } catch (e) {console.log(e)}})
            }

            filenames.forEach(function(el) {
                let row = {};
                row.dir_name = el.substring(el.lastIndexOf(path.sep) + 1).replace(/[\r\n\0\t]/g, "");
                row.parent_id = openedDirectory.dir_id;
                row.children_id_list = '';
                row.is_file = 1;
                row.folder_icon_child_index = -1
                row.short_description = ""

                row.created_timestamp = unixTimestamp();
                row.updated_timestamp = unixTimestamp();
                row.dir_id = row.dir_name.substring(0, 15) + '-' + row.parent_id + '-' + fs.statSync(el)['size']
                + '-' + unixTimestamp() + '-' + Math.floor(Math.random()*1000000);
                
                try {
                    row.real_file_path = storeFile(el, row.dir_id + '.' + getExtension(row))
                } catch (error) {//all kinds of IO errors
                    console.log(error);
                    dialog.showMessageBox(WIN, {
                        title: "Ошибка",
                        message: "При копировании файла "+el+" в служебную папку базы данных " + path.join(dbParentPath, 'database_file_storage_'+dbName)
                        + " произошла ошибка. Файл будет пропущен. Проверьте наличие прав у вашего пользователя на чтение и запись указанной папки.",
                        buttons: ["OK"],
                        defaultId: 0
                    })
                    return;//skips in foreach
                }
                
                db.run(`INSERT INTO tree (dir_id, dir_name, parent_id, is_file, real_file_path,
                    children_id_list, created_timestamp, updated_timestamp, folder_icon_child_index, short_description)
                    VALUES ('${row.dir_id.replace(/[']/g, "''")}', '${row.dir_name.replace(/[']/g, "''")}',
                    '${row.parent_id}', ${row.is_file}, '${row.real_file_path}', '${row.children_id_list}', ${row.created_timestamp},
                    ${row.updated_timestamp}, ${row.folder_icon_child_index}, '${row.short_description}');`
                , function(err) {
                    completeCounter++;
                    if (err) {
                        console.log(err);
                        dialog.showMessageBox(WIN, {
                            title: "Ошибка",
                            message: "При добавлении элемента " + row.dir_name + " произошла ошибка. Повторите попытку.",
                            buttons: ["OK"],
                            defaultId: 0
                        })
                    } else {
                        preparedRows.push(row);
                    }
                    callbackOnEveryInserted();
                    //console.log('completeCounter: ' + completeCounter + '; ' + preparedRows)
                })
            })
            console.log(preparedRows)
        }).catch(err => {
            console.log(err)
        })
    }

    createSubfolder() {
        let row = {};
        row.dir_name = '[введите имя]';
        row.parent_id = openedDirectory.dir_id;
        row.children_id_list = '';
        row.is_file = 0;
        row.real_file_path = '';
        row.folder_icon_child_index = -1
        row.short_description = ""

        row.created_timestamp = unixTimestamp();
        row.updated_timestamp = unixTimestamp();
        row.dir_id = 'folder-' + openedDirectory.dir_name.length + '-' + unixTimestamp() + '-' + Math.floor(Math.random()*1000000000);

        db.run(`INSERT INTO tree (dir_id, dir_name, parent_id, is_file, real_file_path,
            children_id_list, created_timestamp, updated_timestamp, folder_icon_child_index, short_description)
            VALUES ('${row.dir_id}', '${row.dir_name}', '${row.parent_id}', ${row.is_file},
            '${row.real_file_path}', '${row.children_id_list}', ${row.created_timestamp},
            ${row.updated_timestamp}, ${row.folder_icon_child_index}, '${row.short_description}');`
        , function(err) {
            try{
            if (err) {
                console.log(err);
                dialog.showMessageBox(WIN, {
                    title: "Ошибка",
                    message: "При добавлении папки " + row.dir_name + " произошла ошибка. Повторите попытку.",
                    buttons: ["OK"],
                    defaultId: 0
                })
            } else {
                openedDirectory.children_id_list = (openedDirectory.children_id_list == '' ? '' : openedDirectory.children_id_list+'\n') + row.dir_id;
                openedDirectory.updated_timestamp = unixTimestamp();

                db.run(`UPDATE tree SET children_id_list='${openedDirectory.children_id_list}', updated_timestamp=
                    ${openedDirectory.updated_timestamp} WHERE dir_id='${openedDirectory.dir_id}'`, function(err2) {try {
                    if (err2) {
                        console.log(err2);
                        dialog.showMessageBox(WIN, {
                            title: "Ошибка",
                            message: "При добавлении подпапки в папку " + openedDirectory.dir_name
                            + " произошла ошибка. Запустите проверку ошибок на текущей открытой папке.",
                            buttons: ["OK"],
                            defaultId: 0
                        })
                    } else {
                        itemContainer.textContent = '';
                        itemByChildId = {};
                        selectedElements = [];
                        lastClickedElement = null;
                        contextMenuOpened = false;
                        flagFreeSelectionModeOn = false;
                        children.push(row);
                        children.sort(rowComparators.nameAlphabeticalAscending);
                        //console.log(children);
                        for (let i = 0; i<children.length; i++) {
                            let itemNodes = createItemTileView(children[i]);
                            let nameToEdit = itemNodes.itemNameBlock, itemIcon = itemNodes.itemIconBlock;
                            if (children[i].dir_id == row.dir_id) {
                                renameItem(row, nameToEdit, itemIcon)
                            }
                        }
                    }
                } catch (e) {console.log(e)}})
            }} catch (e) {console.log(e)}
        })
    }

    renameItem() {
        let oldDirName = this.dir_name;
        let itemNameBlock = document.getElementById(this.dir_id + '_nameblock');
        let itemIconBlock = document.getElementById(this.dir_id + '_iconblock');
        itemNameBlock.textContent = this.dir_name;
        itemNameBlock.contentEditable = true;
        itemNameBlock.focus()
        //console.log('renameItem call on '+this.dir_id+', ', itemNameBlock)
        var onApply;
        var listenerEnter = function(event) {
            if (event.code == 'Enter') {
                //console.log('event keyup Enter')
                itemNameBlock.blur()
                //onApply is called automatically since blur event occurs
            }
        }
        var listenerRightClick = function(e) {
            e.stopPropagation()
        }
        let extension = getExtension()
        onApply = function(event) {
            itemNameBlock.contentEditable = false;
            itemNameBlock.textContent = itemNameBlock.textContent.replace(/[\n\r\0\t]/g, '');
            //console.log('event.target:', event.target, ', event.currentTarget:', event.currentTarget)
            //console.log(`textContent: '${itemNameBlock.textContent}', this.dir_name: '${this.dir_name}';
            //     ==: ${this.dir_name == itemNameBlock.textContent}`)
            if (this.dir_name == itemNameBlock.textContent || itemNameBlock.textContent == '' ) {
                document.removeEventListener('keyup', listenerEnter);
                itemNameBlock.removeEventListener('blur', onApply)
                itemNameBlock.removeEventListener('contextmenu', listenerRightClick)
                itemNameBlock.textContent = oldDirName.substring(0, 40) + (oldDirName.length > 40 ? '...' : '')
                return;
            }
            this.dir_name = itemNameBlock.textContent;
            db.run(`UPDATE tree SET dir_name='${this.dir_name.replace(/[']/g, "''")}' WHERE dir_id='${this.dir_id}'`, [], function(err) {
                if (err) {
                    console.log(err);
                    this.dir_name = oldDirName;
                    itemNameBlock.textContent = oldDirName.substring(0, 40) + (oldDirName.length > 40 ? '...' : '')
                    dialog.showMessageBox(WIN, {
                        title: "Ошибка",
                        message: "При переименовании элемента " + oldDirName
                        + " произошла ошибка. Переоткройте базу данных и попробуйте еще раз.",
                        buttons: ["OK"],
                        defaultId: 0
                    })
                } else {
                    //console.log('Renamed to '+this.dir_name)
                    itemNameBlock.textContent = this.dir_name.substring(0, 40) + (this.dir_name.length > 40 ? '...' : '')
                    itemNameBlock.title = this.dir_name
                    let extension2 = getExtension()
                    //console.log(extension2)
                    if (this.is_file && extension != extension2) setBgImage(itemIconBlock, this)
                }
                itemNameBlock.removeEventListener('blur', onApply)
                itemNameBlock.removeEventListener('contextmenu', listenerRightClick)
                document.removeEventListener('keyup', listenerEnter);
            })
        }
        itemNameBlock.addEventListener('blur', onApply)
        itemNameBlock.addEventListener('contextmenu', listenerRightClick)
        document.addEventListener('keyup', listenerEnter)
    };

    setBgImage(itemIconBlock) {
        if (this.is_file) {
            let extension = getExtension()
            if (extension) {
                if (extension == 'jpeg' || extension == 'jfif') extension = 'jpg';
                else if (extension == 'htm') extension = 'html'

                if (['jpg', 'svg', 'png', 'gif', 'webp'].includes(extension)) {
                    //console.log(extension)
                    createAndCacheMiniature(this.real_file_path, itemIconBlock, this)
                } else if (extension == 'bmp') {
                    let tempImg = document.createElement('img')
                    tempImg.onerror = function(e) {
                        console.log(e)
                        itemIconBlock.style.backgroundImage = "url('icon/filebmp.png')"
                    }
                    tempImg.onload = function() {
                        itemIconBlock.style.backgroundImage = this.real_file_path;
                    }
                    tempImg.src = this.real_file_path;
                } else {
                    let exists = fs.existsSync(path.join(__dirname, 'icon/file'+extension+'.png'))
                    if (exists) itemIconBlock.style.backgroundImage = "url('icon/file"+extension+".png')";
                    else itemIconBlock.style.backgroundImage = "url('icon/file.png')"
                }
            } else {
                itemIconBlock.style.backgroundImage = "url('icon/file.png')"
            }
        } else {
            itemIconBlock.style.backgroundImage = "url('icon/folder.png')"
        }
    }

    openItem() {
        if (this.is_file) {
            const extension = getExtension(this)
            if (extension == 'sqlite3db') {
                db.close((err) => {
                    if (err) console.log(err);
                    db = null;
                    isTransactionOngoing = false
                    openOrCreateDatabase(this.real_file_path)
                });
            } else {
                if (fs.existsSync(this.real_file_path)) exec(getCommandLine() + ' "' + this.real_file_path + '"');
                else {
                    dialog.showMessageBox(WIN, {
                        title: "Ошибка",
                        message: "Файл по пути " + this.real_file_path + ", на который ссылается элемент " + this.dir_name
                        + ", перемещен, переименован или удален. Удалите этот элемент или отредактируйте путь к файлу.",
                        buttons: ["OK"],
                        defaultId: 0
                    })
                }
            }
        } else {
            instrumentPanel.remove();
            itemContainer.remove();
            flagFreeSelectionModeOn = false;
            document.body.removeEventListener('mouseup', bodyMouseUpListener)
            document.body.removeEventListener('mouseleave', bodyMouseUpListener)
            displayFolderContent(this.dir_id)
        }
    }

    constructor(dbEntry, selection,  itemContainer) {
        this.dbEntry = dbEntry
        this.children = []
        this.extension = this.getExtension()

        let item = document.createElement('div')
        item.className = 'item_tile_view'
        itemByChildId[dbEntry.dir_id] = item
        let itemIconBlock = document.createElement('div')
        itemIconBlock.id = dbEntry.dir_id + '_iconblock'
        itemIconBlock.className = 'item_tile_view_icon_block project_brick_icon_block'
        item.appendChild(itemIconBlock)

        this.setBgImage(itemIconBlock, dbEntry)

        let itemName = document.createElement('div')
        let itemNameBlock = document.createElement('div')
        itemNameBlock.id = dbEntry.dir_id + '_nameblock'
        itemNameBlock.textContent = dbEntry.dir_name.substring(0, 40) + (dbEntry.dir_name.length > 40 ? '...' : '')
        itemNameBlock.title = dbEntry.dir_name
        itemNameBlock.className = 'item_tile_view_name_block'
        let spacer = document.createElement('div')
        spacer.className = 'item_tile_view_name_block'
        spacer.style.height = '100%'
        itemName.appendChild(spacer)
        itemName.appendChild(itemNameBlock)
        item.appendChild(itemName)

        itemIconBlock.ondblclick = function() {
            this.openItem();
        }
        itemName.ondblclick = function() {
            this.selectItem(false)
            this.renameItem(itemNameBlock, itemIconBlock)
        }
        item.onclick = function(event) {
            if (event.ctrlKey || event.shiftKey && !lastClickedElement) {
                this.selectItem(true);
            } else if (event.shiftKey) {
                let indexChildFrom = children.indexOf(lastClickedElement);
                let indexChildTo = children.indexOf(this.dbEntry);

                if (indexChildFrom == indexChildTo) {
                    this.selectItem(true);
                    return;
                }

                if (indexChildFrom > indexChildTo) {
                    let temp = indexChildTo;
                    indexChildTo = indexChildFrom - 1;
                    indexChildFrom = temp;
                } else {
                    indexChildFrom += 1;//+-1 здесь исключает сам последний выбранный элемент
                }

                let isCurrentClickedInSelection = selectedElements.includes(this)
                let isLastClickedInSelection = selectedElements.includes(lastClickedElement)
                //console.log(`In selection ${lastClickedElement.dir_id}: current ${isCurrentClickedInSelection}, 
                //    last ${isLastClickedInSelection}`)
                if (isCurrentClickedInSelection === isLastClickedInSelection) {
                    //наше намерение - убрать выделение с child, а значит последний элемент тоже надо убрать
                    //ИЛИ наше намерение - добавить child в выделение, а значит последний надо оставить
                    this.selectItem(lastClickedElement, true)
                }
                //console.log(`from ${indexChildFrom} to ${indexChildTo}`)
                for (let i = indexChildFrom; i<=indexChildTo; i++) {
                    let childBetween = children[i];
                    this.selectItem(childBetween, true)
                }
            } else {
                this.selectItem(false);
            }

            lastClickedElement = this;
        }
        item.oncontextmenu = function(event) {
            if (event.shiftKey) {
                this.selectItem(false);
            } else if (selectedElements.length == 0 || event.ctrlKey) {
                this.selectItem(event.ctrlKey);
            }
            //if nothing selected OR ctrl pressed, select current (add if ctrl) and open menu for selected links
        }
        item.onmouseenter = function(e) {
            if (flagFreeSelectionModeOn) {
                this.selectItem(true)
            }
        }
        item.onmousedown = function(e) {
            //drag files and folders around
            if (e.button == 0 || e.button == 2) {//right or left mousedown, not middle button
                e.stopPropagation();
            }
        }
        itemContainer.appendChild(item)
        return {itemNameBlock: itemNameBlock, itemIconBlock: itemIconBlock};
    }
}