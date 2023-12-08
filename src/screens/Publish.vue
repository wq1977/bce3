<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project';
import router from '../router';
const store = useProjectStore()
const route = useRoute()
const project = ref(null);
if (!store.list.length) {
    store.load().then(init)
} else {
    init()
}
const desc = ref('')

function fmt(secs) {
    const minutes = Math.floor(secs / 60)
    const seconds = Math.floor(secs % 60)
    return `${minutes >= 10 ? minutes : `0${minutes}`}:${seconds >= 10 ? seconds : `0${seconds}`}`
}

async function init() {
    project.value = store.list.filter(p => p.id == route.query.id)[0]
    await store.prepare(project.value)
    await store.loadTracks(project.value)
    if (project.value.desc) {
        desc.value = project.value.desc
    } else {
        store.getProjectSources(project.value)
        desc.value = (project.value.paragraphs || [])
            .filter((p) => p.comment)
            .sort((a, b) => a.sequence - b.sequence).filter(p => !isNaN(parseFloat(p.when))).map(p => `[${fmt(p.when)}] ${p.comment}`).join('\n')
    }
}

async function doPublish() {
    project.value.desc = desc.value ? desc.value.trim() : ''
    project.value.updateat = new Date().getTime()
    const duration = await store.doExport(project.value)
    project.value.duration = duration
    store.saveProject(project.value)
    await store.doPublish(project.value)
    await router.push(`/view?album=${project.value.album}&episode=${project.value.id}`)
}

</script>
<template>
    <div v-if="project" class="h-[80vh] flex flex-col">
        <div class="relative border-t border-white bg-gray-300 mt-[50px] h-[80px]">
            <div v-if="store.progressType" :style="{ width: `${store.progress * 100}%` }"
                class="absolute z-0 left-0 top-0 bottom-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
            </div>
            <div class="z-[1] absolute left-0 top-0 bottom-0 flex items-center justify-end right-0 p-5 ">
                <span v-if="store.progressType == 'rsync'" class="m-auto "> 正在发布 {{ (store.progress * 100).toFixed(2) }}%
                    ...
                </span>
                <span v-if="store.progressType == 'mp3'" class="m-auto "> 正在导出 {{ (store.progress * 100).toFixed(2) }}% ...
                </span>
                <span v-if="store.progressType == 'play'" class="m-auto  "> 正在并轨 {{ (store.progress * 100).toFixed(2) }}%
                    ...
                </span>
                <button @click="doPublish" :disabled="!!store.progressType"
                    class="disabled:bg-gray-300 disabled:text-gray-500 text-green-800 mr-5 font-semibold shadow-gray-700 hover:bg-green-300 inline-flex h-[35px] items-center justify-center rounded-[4px] bg-white px-[15px] leading-none shadow-[0_2px_10px] focus:outline-none">发布</button>

            </div>
        </div>
        <div class="flex-1 flex flex-col items-center justify-center mt-[10px]">
            <textarea class="font-mono flex-1 border p-2 w-full h-full" v-model="desc" />
        </div>
    </div>
</template>