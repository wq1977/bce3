<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project';
const store = useProjectStore()
const route = useRoute()
const project = ref(null);
store.load().then(async () => {
    project.value = store.list.filter(p => p.id == route.query.id)[0]
    await store.prepare(project.value)
})
</script>
<template>
    <div v-if="project">
        <h1>Editor -- {{ project.name }}</h1>
        <span v-if="project.loading">Loading ...</span>
        <div v-for="paragraph in project.paragraphs" class="text-justify leading-relaxed p-2">
            {{ paragraph.text }}
        </div>
        <div class="fixed right-1 bottom-1">
            <button @click="store.play()"
                class="w-[70px] h-[70px] rounded-full border-2 hover:bg-gray-600 bg-gray-600/70 text-white">play</button>
        </div>
    </div>
</template>