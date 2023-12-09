<script setup>
import { ref, computed, watch } from 'vue';
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

const albumSetupDialogOpen = ref(false)
const targetAlnum = ref(null)

function setupAlbum(album) {
    targetAlnum.value = album
}

watch(() => targetAlnum.value, () => {
    if (targetAlnum.value) {
        albumSetupDialogOpen.value = true
    }
})

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
        <div class="text-right relative">
            <button class="bg-gray-200 border rounded px-4 py-2" @click="projStore.newAlbum()">创建新专辑</button>
        </div>
        <Draggable v-if="noAlbumList.length" v-model="noAlbumList" group="card" item-key="id"
            class="flex flex-wrap items-center  justify-center bg-gradient-to-r from-teal-300 to-blue-500 p-8">
            <template #item="{ element: proj }">
                <ProjectCard :project="proj" />
            </template>
            <template #footer>
                <div @click="createProject({ cfg: {} })"
                    class="text-white/70 hover:text-gray-500 group relative border cursor-pointer rounded m-2 p-2 flex items-center justify-center w-[200px] min-h-[100px]">
                    <Icon class="text-[40px]" icon="typcn:plus"></Icon>
                </div>
                <div v-for="i in [1, 2, 3, 4, 5]" class=" w-[200px] m-2 h-[0]">
                </div>
            </template>
        </Draggable>
        <div v-for="album in albums" :key="album.id" class="flex flex-col mt-4">
            <div class="flex items-start">
                <img @click="projStore.setupAlbumCover(album)" :src="album.coverUrl || IconAlbum"
                    class="w-[80px] cursor-pointer rounded mr-2 object-cover" />
                <div class="flex flex-1 flex-col">
                    <input class="font-bold text-lg self-start p-1" v-model="album.name" placeholder="未命名专辑"
                        @change="saveAlbum(album)" />
                    <input class="text-sm text-gray-500 self-start p-1 mt-[1px]" v-model="album.desc" placeholder="添加专辑描述"
                        @change="saveAlbum(album)" />
                </div>
                <div class="flex justify-start self-stretch p-3">
                    <Icon @click="setupAlbum(album)" class="cursor-pointer mr-2 text-gray-300 hover:text-gray-500"
                        icon="file-icons:config" />
                    <RouterLink :to="`/view?album=${album.id}`">
                        <Icon class="cursor-pointer text-gray-300 hover:text-gray-500" icon="mdi:web" />
                    </RouterLink>
                </div>
            </div>
            <Draggable group="card" v-model="album.list.value" item-key="id"
                class="flex flex-wrap items-center mt-2 items-stretch justify-center bg-gradient-to-r from-teal-300 to-blue-500 p-8">
                <template #item="{ element: proj, index }">
                    <ProjectCard :project="proj" />
                </template>
                <template #footer>
                    <div @click="createProject({ album: album.id, cfg: {} })"
                        class="text-white/70 hover:text-gray-500 group relative border cursor-pointer rounded m-2 p-2 flex items-center justify-center w-[200px] min-h-[100px]">
                        <Icon class="text-[40px]" icon="typcn:plus"></Icon>
                    </div>
                    <div v-for="i in [1, 2, 3, 4, 5]" class="w-[200px] m-2 h-[0]">
                    </div>
                </template>
            </Draggable>
        </div>
        <DialogRoot v-model:open="albumSetupDialogOpen">
            <DialogPortal>
                <DialogOverlay class="bg-blackA9 data-[state=open]:animate-overlayShow fixed inset-0 z-30" />
                <DialogContent
                    class="data-[state=open]:animate-contentShow fixed top-[50%] left-[50%] max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] rounded-[6px] bg-white p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none z-[100]">
                    <DialogTitle class="text-mauve12 m-0 text-[17px] font-semibold">
                        设置专辑参数
                    </DialogTitle>
                    <DialogDescription class="text-mauve11 mt-[10px] mb-5 text-[15px] leading-normal">
                        请确保你已经创建好了相关的主机，并且设置好了访问密钥.
                    </DialogDescription>
                    <fieldset class="mb-[15px] flex items-center gap-5">
                        <label class="text-grass11 w-[90px] text-right text-[15px]" for="hostname"> 主机名 </label>
                        <input id="hostname" v-model="targetAlnum.hostname"
                            class="text-grass11 shadow-green7 focus:shadow-green8 inline-flex h-[35px] w-full flex-1 items-center justify-center rounded-[4px] px-[10px] text-[15px] leading-none shadow-[0_0_0_1px] outline-none focus:shadow-[0_0_0_2px]">
                    </fieldset>
                    <fieldset class="mb-[15px] flex items-center gap-5">
                        <label class="text-grass11 w-[90px] text-right text-[15px]" for="username"> 用户名
                        </label>
                        <input id="username" v-model="targetAlnum.username"
                            class="text-grass11 shadow-green7 focus:shadow-green8 inline-flex h-[35px] w-full flex-1 items-center justify-center rounded-[4px] px-[10px] text-[15px] leading-none shadow-[0_0_0_1px] outline-none focus:shadow-[0_0_0_2px]">
                    </fieldset>
                    <fieldset class="mb-[15px] flex items-center gap-5">
                        <label class="text-grass11 w-[90px] text-right text-[15px]" for="folder"> 文件路径
                        </label>
                        <input id="folder" v-model="targetAlnum.path"
                            class="text-grass11 shadow-green7 focus:shadow-green8 inline-flex h-[35px] w-full flex-1 items-center justify-center rounded-[4px] px-[10px] text-[15px] leading-none shadow-[0_0_0_1px] outline-none focus:shadow-[0_0_0_2px]">
                    </fieldset>
                    <div class="mt-[25px] flex justify-end">
                        <DialogClose as-child>
                            <button @click="() => { saveAlbum(targetAlnum); targetAlnum.value = null }"
                                class="bg-green4 text-green11 hover:bg-green5 focus:shadow-green7 inline-flex h-[35px] items-center justify-center rounded-[4px] px-[15px] font-semibold leading-none focus:shadow-[0_0_0_2px] focus:outline-none">
                                保存
                            </button>
                        </DialogClose>
                    </div>
                    <DialogClose
                        class="text-grass11 hover:bg-green4 focus:shadow-green7 absolute top-[10px] right-[10px] inline-flex h-[25px] w-[25px] appearance-none items-center justify-center rounded-full focus:shadow-[0_0_0_2px] focus:outline-none"
                        aria-label="Close">
                        <Icon icon="lucide:x" />
                    </DialogClose>
                </DialogContent>
            </DialogPortal>
        </DialogRoot>
    </div>
</template>