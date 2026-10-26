import { createFileRoute, getRouteApi, notFound } from '@tanstack/react-router'
import { features } from '@/config/features'
import { PageHeading } from '@/components/common'
import { FileLibrary } from '@/components/file-library'
import { useI18n } from '@/components/providers'
export const Route = createFileRoute('/app/files')({
  beforeLoad: () => {
    if (!features.files) throw notFound()
  },
  component: Files,
})
function Files() {
  const { t } = useI18n(),
    viewer = getRouteApi('/app').useLoaderData()
  return (
    <>
      <PageHeading
        eyebrow="IMAGE LIBRARY"
        title={t('files_title')}
        description={viewer.local ? t('files_local') : t('files_cloud')}
      />
      <FileLibrary userId={viewer.user.id} />
    </>
  )
}
