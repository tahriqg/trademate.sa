// Shrinks a chosen logo image so it is small enough to store and print on a PDF.
export function fileToLogoDataUrl(file, maxW = 400, maxH = 200) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (PNG or JPG).'))
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('That image is too large. Please choose one under 8 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('That image could not be read.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('That image could not be read.'))
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/png')
        if (dataUrl.length > 400000) {
          reject(new Error('That logo is too detailed. Please use a simpler or smaller image.'))
          return
        }
        resolve(dataUrl)
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
