<script setup>
import { useRouter } from 'vue-router';
import { useProjectStore } from '../stores/project'
import moment from 'moment'
const projStore = useProjectStore();
const router = useRouter()
function fmtDate(ts) {
    return moment(ts).format('YYYY-MM-DD')
}
function createProject() {
    const id = projStore.newProject()
    router.push(`/editor/track?id=${id}`)
}
</script>
<template>
    <div class="flex flex-wrap items-center justify-center bg-gradient-to-r from-teal-300 to-blue-500 p-8">
        <div v-for="proj in projStore.list.filter(p => p.tracks.length)"
            @click="$router.push({ path: '/editor/paragraph', query: { id: proj.id } })"
            class="border cursor-pointer rounded m-2 p-2 flex flex-col w-[200px]">
            <span class="text-xl font-black"> {{ proj.name || '未命名' }} </span>
            <span class="text-xs mt-1 text-gray-600">ID: {{ proj.id }}</span>
            <span class="text-xs text-right mt-5 text-gray-500">{{ fmtDate(proj.modified) }}</span>
        </div>
    </div>
    <div class="flex justify-center p-5">
        <button @click="createProject" class="border rounded px-4 py-2">来一集新播客</button>
    </div>
</template>