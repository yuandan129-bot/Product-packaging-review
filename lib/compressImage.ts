/**
 * 客户端图片压缩 —— 将 File 转 dataURL 前先缩尺寸 + 降质量，
 * 避免 base64 编码后超过 API 请求体限制（如 413 Payload Too Large）。
 */
export function compressImage(
  file: File,
  opts: { maxWidth: number; maxHeight: number; quality: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > opts.maxWidth || height > opts.maxHeight) {
        const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, width, height)

      resolve(canvas.toDataURL("image/jpeg", opts.quality))
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("图片加载失败"))
    }
  })
}
