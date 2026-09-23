import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../pages/guest/HomePage.vue')
    },
    {
      path: '/contact-detail',
      name: 'contact-detail',
      component: () => import('../pages/guest/ContactDetail.vue')
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('../pages/admin/AdminLogin.vue')
    },
    {
      path: '/admin/bootstrap',
      name: 'admin-bootstrap',
      component: () => import('../pages/admin/AdminBootstrap.vue')
    },
    {
      path: '/admin',
      component: () => import('../pages/admin/AdminLayout.vue'),
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('../pages/admin/AdminDashboard.vue')
        },
        {
          path: 'edit',
          name: 'admin-edit',
          component: () => import('../pages/admin/AdminEdit.vue')
        },
        {
          path: 'drafts',
          name: 'admin-drafts',
          component: () => import('../pages/admin/AdminDrafts.vue')
        },
        {
          path: 'certificates',
          name: 'admin-certificates',
          component: () => import('../pages/admin/AdminCertificates.vue')
        },
        {
          path: 'favorites',
          name: 'admin-favorites',
          component: () => import('../pages/admin/AdminFavorites.vue')
        },
        {
          path: 'published',
          name: 'admin-published',
          component: () => import('../pages/admin/AdminPublishedHistory.vue')
        },
        {
          path: 'media',
          name: 'admin-media',
          component: () => import('../pages/admin/AdminMedia.vue')
        },
        {
          path: 'media/library',
          name: 'admin-asset-library',
          component: () => import('../pages/admin/AdminAssetLibrary.vue')
        },
        {
          path: 'media/images',
          name: 'admin-media-images',
          component: () => import('../pages/admin/AdminMediaImages.vue')
        },
        {
          path: 'media/videos',
          name: 'admin-media-videos',
          component: () => import('../pages/admin/AdminMediaVideos.vue')
        },
        {
          path: 'media/documents',
          name: 'admin-media-documents',
          component: () => import('../pages/admin/AdminMediaDocuments.vue')
        },
        {
          path: 'maintenance',
          name: 'admin-maintenance',
          component: () => import('../pages/admin/AdminMaintenance.vue')
        },
        {
          path: 'messages',
          name: 'admin-messages',
          component: () => import('../pages/admin/AdminMessages.vue')
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../pages/NotFoundPage.vue')
    }
  ]
})

router.beforeEach(async (to) => {
  if (!to.path.startsWith('/admin') || to.name === 'admin-login' || to.name === 'admin-bootstrap') return true
  const { useAuthStore } = await import('../stores/auth')
  const auth = useAuthStore()
  await auth.initialize()
  return auth.isAdmin ? true : { name: 'admin-login', query: { redirect: to.fullPath } }
})

export default router
