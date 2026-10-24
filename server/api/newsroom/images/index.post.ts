// Upload a cover image (multipart field "file"): JPEG, PNG or WebP up to 2 MB. Newsroom accounts only.
export default defineEventHandler(async (event) => {
  await requireEntitlement(event, 'newsroom')
  const file = (await readMultipartFormData(event))?.find(p => p.name === 'file')
  if (!file?.data.length) throw createError({ statusCode: 400, statusMessage: 'No image in the upload' })
  const id = await saveImage(new Uint8Array(file.data.buffer, file.data.byteOffset, file.data.byteLength))
  return { id, src: imageUrl(id) }
})
