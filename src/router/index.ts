import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '../pages/guest/HomePage.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage
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
          path: 'media',
          name: 'admin-media',
          component: () => import('../pages/admin/AdminMedia.vue')
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
    }
  ]
})

export default router
