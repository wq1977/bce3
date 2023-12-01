<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project';
const store = useProjectStore()
const route = useRoute()
const project = ref(null);
if (!store.list.length) {
    store.load().then(init)
} else {
    init()
}
async function init() {
    project.value = store.list.filter(p => p.id == route.query.id)[0]
    await store.prepare(project.value)
    await store.loadTracks(project.value)
}
</script>
<template>
    <div v-if="project">
        <div class="border-t border-white bg-gray-300 p-5 text-right mt-[50px]">
            <button @click="store.doExport(project)"
                class="text-green-800 mr-5 font-semibold shadow-gray-700 hover:bg-green-300 inline-flex h-[35px] items-center justify-center rounded-[4px] bg-white px-[15px] leading-none shadow-[0_2px_10px] focus:outline-none">导出</button>
        </div>
    </div>
</template>