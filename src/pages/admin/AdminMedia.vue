<template>
  <div class="admin-media-page">
    <div class="media-toolbar">
      <button class="upload-btn" @click="handleUploadClick">
        <Upload class="upload-icon" />
        <span>+ Upload</span>
      </button>
    </div>

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

const handleUploadClick = () => {
  // Upload functionality pending implementation
}

const handleCardAction = (_category: MediaCategory) => {
  // Card action pending implementation
}
</script>

<style scoped>
.admin-media-page {
  background: #F6F4E8;
  min-height: 100vh;
  padding: 1.5rem 2rem;
  font-family: 'Inter', system-ui, sans-serif;
}

.media-toolbar {
  margin-bottom: 1.5rem;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: #FFE4B5;
  color: #5A3E35;
  border: 1px solid #E8DED0;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-btn:hover {
  background: #FFDE9E;
}

.upload-icon {
  width: 18px;
  height: 18px;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.media-card {
  background: #FAF9F5;
  border-radius: 24px;
  padding: 24px;
  box-shadow: 0 8px 25px -12px rgba(90, 62, 53, 0.1), 0 0 0 1px rgba(90, 62, 53, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  transition: all 0.2s ease;
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
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: linear-gradient(150deg, #FFF5EB 0%, #FFE4B5 100%);
  margin-bottom: 1rem;
  box-shadow: inset 0 2px 6px rgba(90, 62, 53, 0.06);
}

.illustration-icon {
  width: 36px;
  height: 36px;
  color: #7B5F3B;
  opacity: 0.85;
}

.media-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: #FF8F5A;
  color: #FFFFFF;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(255, 143, 90, 0.3);
}

.card-title {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #5A3E35;
}

.card-description {
  margin: 0 0 1.5rem 0;
  font-size: 0.8rem;
  color: #7B5F3B;
  line-height: 1.4;
  max-width: 180px;
}

.card-actions {
  width: 100%;
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
  font-size: 0.85rem;
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
  width: 16px;
  height: 16px;
}

.action-label {
  flex: 1;
  text-align: center;
}

.action-chevron {
  width: 16px;
  height: 16px;
}

@media (max-width: 1024px) {
  .media-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .media-grid {
    grid-template-columns: 1fr;
  }
  
  .admin-media-page {
    padding: 1.5rem;
  }
  
  .card-illustration {
    width: 64px;
    height: 64px;
  }
  
  .illustration-icon {
    width: 32px;
    height: 32px;
  }
  
  .card-title {
    font-size: 0.95rem;
  }
  
  .card-description {
    font-size: 0.75rem;
    max-width: 140px;
  }
}
</style>