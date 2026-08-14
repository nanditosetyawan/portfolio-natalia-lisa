import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from '../pages/guest/HomePage.vue'
import AdminLayout from '../pages/admin/AdminLayout.vue'
import AdminDashboard from '../pages/admin/AdminDashboard.vue'
import AdminEdit from '../pages/admin/AdminEdit.vue'
import AdminMedia from '../pages/admin/AdminMedia.vue'
import AdminMaintenance from '../pages/admin/AdminMaintenance.vue'
import AdminMessages from '../pages/admin/AdminMessages.vue'

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
      component: AdminLayout,
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: AdminDashboard
        },
        {
          path: 'edit',
          name: 'admin-edit',
          component: AdminEdit
        },
        {
          path: 'media',
          name: 'admin-media',
          component: AdminMedia
        },
        {
          path: 'maintenance',
          name: 'admin-maintenance',
          component: AdminMaintenance
        },
        {
          path: 'messages',
          name: 'admin-messages',
          component: AdminMessages
        }
      ]
    }
  ]
})

export default router
