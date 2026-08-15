<template>
  <div class="admin-media-page">
    <div class="media-grid">
      <div
        v-for="category in mediaCategories"
        :key="category.id"
        class="media-card"
        :class="{ 'media-card-selected': category.selected }"
      >
        <div class="card-illustration">
          <component :is="category.icon" class="illustration-icon" />
          <span
            v-if="category.badge"
            class="media-badge"
          >
            {{ category.badge }}
          </span>
        </div>
        <h3 class="card-title">{{ category.title }}</h3>
        <p class="card-description">{{ category.description }}</p>
        <div class="card-actions">
          <button class="card-action-btn" @click="handleCardAction(category)">
            <component :is="category.actionIcon" class="action-left-icon" />
            <span class="action-label">{{ category.buttonLabel }}</span>
            <ChevronRight class="action-chevron" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Image, FileText, Video, Heart, Trash2, Upload, ChevronRight, Eye } from 'lucide-vue-next'

interface MediaCategory {
  id: string
  title: string
  description: string
  icon: any
  badge?: number | null
  actionIcon: any
  buttonLabel: string
  selected: boolean
}

const mediaCategories = ref<MediaCategory[]>([
  {
    id: 'images',
    title: 'Gambar',
    description: 'Semua file gambar dari koleksi Anda',
    icon: Image,
    badge: 3,
    actionIcon: Eye,
    buttonLabel: 'Lihat Semua',
    selected: false
  },
  {
    id: 'upload',
    title: 'Upload',
    description: 'Unggah file baru ke koleksi Anda',
    icon: Upload,
    badge: null,
    actionIcon: Upload,
    buttonLabel: 'Upload Media',
    selected: false
  },
  {
    id: 'videos',
    title: 'Video',
    description: 'Semua file video dari koleksi Anda',
    icon: Video,
    badge: 1,
    actionIcon: Eye,
    buttonLabel: 'Lihat Semua',
    selected: false
  },
  {
    id: 'documents',
    title: 'Dokumen',
    description: 'Semua file dokumen dari koleksi Anda',
    icon: FileText,
    badge: 2,
    actionIcon: Eye,
    buttonLabel: 'Lihat Semua',
    selected: false
  },
  {
    id: 'favorites',
    title: 'Favorit',
    description: 'Media favorit Anda yang disimpan',
    icon: Heart,
    badge: null,
    actionIcon: Eye,
    buttonLabel: 'Lihat Semua',
    selected: false
  },
  {
    id: 'trash',
    title: 'Sampah',
    description: 'File yang telah dihapus dan tidak langsung dihapus permanen',
    icon: Trash2,
    badge: 4,
    actionIcon: Eye,
    buttonLabel: 'Lihat Semua',
    selected: false
  }
])

const handleCardAction = (_category: MediaCategory) => {
  // Card action pending implementation
}
</script>

<style scoped>
.admin-media-page {
  background: #F6F4E8;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 0 2rem 2rem;
  font-family: 'Inter', system-ui, sans-serif;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  width: 100%;
  max-width: 1200px;
  margin: 24px auto 0;
}

.media-card {
  background: #FAF9F5;
  border-radius: 24px;
  padding: 20px;
  box-shadow: 0 8px 25px -12px rgba(90, 62, 53, 0.1), 0 0 0 1px rgba(90, 62, 53, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  transition: all 0.2s ease;
  height: 100%;
}

.media-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px -8px rgba(90, 62, 53, 0.12), 0 0 0 1px rgba(90, 62, 53, 0.06);
}

.card-illustration {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(150deg, #FFF5EB 0%, #FFE4B5 100%);
  margin-bottom: 0.75rem;
  box-shadow: inset 0 2px 6px rgba(90, 62, 53, 0.06);
}

.illustration-icon {
  width: 32px;
  height: 32px;
  color: #7B5F3B;
  opacity: 0.85;
}

.media-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: #FF8F5A;
  color: #FFFFFF;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(255, 143, 90, 0.3);
}

.card-title {
  margin: 0 0 0.25rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #5A3E35;
}

.card-description {
  margin: 0 0 1rem 0;
  font-size: 0.75rem;
  color: #7B5F3B;
  line-height: 1.35;
  max-width: 160px;
}

.card-actions {
  width: 100%;
  margin-top: auto;
}

.card-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #FFF5EB;
  color: #5A3E35;
  border: 1px solid #E8DED0;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  justify-content: center;
}

.card-action-btn:hover {
  background: #FFDE9E;
}

.action-left-icon {
  width: 14px;
  height: 14px;
}

.action-label {
  flex: 1;
  text-align: center;
}

.action-chevron {
  width: 14px;
  height: 14px;
}

@media (max-width: 1024px) {
  .media-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
  }
  
  .admin-media-page {
    padding: 0 1.5rem 1.5rem;
  }
}

@media (max-width: 767px) {
  .media-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .admin-media-page {
    padding: 0 1rem 1rem;
  }
  
  .media-card {
    padding: 18px;
  }
  
  .card-illustration {
    width: 56px;
    height: 56px;
    border-radius: 14px;
  }
  
  .illustration-icon {
    width: 28px;
    height: 28px;
  }
  
  .card-title {
    font-size: 0.9rem;
  }
  
  .card-description {
    font-size: 0.7rem;
    max-width: 140px;
  }
  
  .card-action-btn {
    font-size: 0.75rem;
    padding: 0.45rem 0.65rem;
  }
  
  .action-left-icon,
  .action-chevron {
    width: 13px;
    height: 13px;
  }
}
</style>