module.exports = class Cache {
    clearMiniatureCache() {
        try {
            fs.rmdirSync(path.join(app.getPath('home'), '.filesysemu_miniature_cache'), { recursive: true });
            console.log('Miniature cache folder is deleted!');
        } catch (err) {
            console.log(err)
        }
        miniatureCache = {}
        miniatureCache.count = 0
    }

    createAndCacheMiniature(filePath, itemTag, row) {
        if (miniatureCache.count > 1000) clearMiniatureCache();
        const extension = getExtension(row)

        let tempImg = document.createElement('img')
        tempImg.onerror = function(e) {
            console.log(e)
            itemTag.style.backgroundImage = "url('icon/file"+extension+".png')"
        }
        if (miniatureCache[filePath]) {
            //console.log('уже есть миниатюра: '+miniatureCache[filePath])
            tempImg.onload = function() {
                //console.log('tempImg onload. src:', miniatureCache[filePath])
                itemTag.style.backgroundImage = "url('" + miniatureCache[filePath].replace(/\\/g, '/') + "')";
            }
            tempImg.src = miniatureCache[filePath];
        } else {
            //console.log('нет миниатюры')
            let miniatureFolder = path.join(app.getPath('home'), '.filesysemu_miniature_cache')
            if (!fs.existsSync(miniatureFolder)) fs.mkdirSync(miniatureFolder, { recursive: true })
            let outPath = path.join(miniatureFolder, row.dir_id + '.png')

            sharp(filePath)
                .resize(200, 200, {fit: 'inside'})
                .toFile(outPath, (err, info) => {
                    if (err) console.log(err);
                    miniatureCache[filePath] = outPath;
                    miniatureCache.count++;
                    tempImg.onload = function() {
                        //console.log('tempImg onload. src:', outPath)
                        itemTag.style.backgroundImage = "url('" + outPath.replace(/\\/g, '/') + "')";
                    }
                    tempImg.src = outPath;
                });
        }
    }

    constructor() {
        var miniatureCache = {}
        miniatureCache.count = 0
    }
};