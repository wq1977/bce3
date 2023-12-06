<script setup>
import { computed } from 'vue';
import { useProjectStore } from '../stores/project'
import Draggable from 'vuedraggable'
import { Icon } from '@iconify/vue';
import ProjectCard from '../component/project_card.vue'
import { useRouter } from 'vue-router';
import IconAlbum from "../../assets/album.png"
const projStore = useProjectStore();
const router = useRouter()
function createProject(options = {}) {
    const id = projStore.newProject(options)
    router.push(`/editor/track?id=${id}`)
}

function saveAlbum(album) {
    album.updated = new Date().getTime()
    const { list, ...other } = album
    for (let i = 0; i < projStore.albums.length; i++) {
        if (projStore.albums[i].id == album.id) {
            projStore.albums[i] = { ...other }
        }
    }
    projStore.saveAlbums()
}

const noAlbumList = computed({
    get: () => projStore.list.filter(p => p.tracks.length && !p.album).sort((a, b) => (a.albumIndex || 0) - (b.albumIndex || 0)),
    set(list) {
        list.forEach((proj, idx) => {
            proj.album = ''
            proj.albumIndex = idx
            projStore.saveProject(proj)
        })
    }
})

const albums = computed(() => projStore.albums.map(album => ({
    ...album,
    list: computed({
        get: () => projStore.list.filter(p => p.tracks.length && p.album == album.id).sort((a, b) => (a.albumIndex || 0) - (b.albumIndex || 0)),
        set(list) {
            list.forEach((proj, idx) => {
                proj.album = album.id
                proj.albumIndex = idx
                projStore.saveProject(proj)
            })
        }
    })
})))

</script>
<template>
    <div class="p-10">
        <div class="text-right">
            <button class="bg-gray-200 border rounded px-4 py-2" @click="projStore.newAlbum()">创建新专辑</button>
        </div>
        <Draggable v-if="noAlbumList.length" v-model="noAlbumList" group="card" item-key="id"
            class="flex flex-wrap items-center  justify-center bg-gradient-to-r from-teal-300 to-blue-500 p-8">
            <template #item="{ element: proj }">
                <ProjectCard :project="proj" />
            </template>
            <template #footer>
                <div @click="createProject({ cfg: {} })"
                    class="text-white/70 hover:text-gray-500 group relative border cursor-pointer rounded m-2 p-2 flex items-center justify-center w-[200px]  h-[100px]">
                    <Icon class="text-[40px]" icon="typcn:plus"></Icon>
                </div>
                <div v-for="i in [1, 2, 3, 4, 5]" class=" w-[200px] m-2 h-[0]">
                </div>
            </template>
        </Draggable>
        <div v-for="album in albums" class="flex flex-col mt-4">
            <div class="flex items-center">
                <img :src="IconAlbum" class="w-[80px]" />
                <div class="flex flex-1 flex-col">
                    <input class="font-bold text-lg self-start p-1" v-model="album.name" placeholder="未命名专辑"
                        @change="saveAlbum(album)" />
                    <input class="text-sm text-gray-500 self-start p-1 mt-[1px]" v-model="album.desc" placeholder="添加专辑描述"
                        @change="saveAlbum(album)" />
                </div>
                <div class="flex flex-col justify-start self-stretch p-3">
                    <RouterLink :to="`/view?album=${album.id}`">
                        <Icon class="cursor-pointer" icon="mdi:web" />
                    </RouterLink>
                </div>
            </div>
            <Draggable group="card" v-model="album.list.value" item-key="id"
                class="flex flex-wrap items-center mt-2 justify-center bg-gradient-to-r from-teal-300 to-blue-500 p-8">
                <template #item="{ element: proj, index }">
                    <ProjectCard :project="proj" />
                </template>
                <template #footer>
                    <div @click="createProject({ album: album.id, cfg: {} })"
                        class="text-white/70 hover:text-gray-500 group relative border cursor-pointer rounded m-2 p-2 flex items-center justify-center w-[200px]  h-[100px]">
                        <Icon class="text-[40px]" icon="typcn:plus"></Icon>
                    </div>
                    <div v-for="i in [1, 2, 3, 4, 5]" class="w-[200px] m-2 h-[0]">
                    </div>
                </template>
            </Draggable>
        </div>
    </div>
</template>