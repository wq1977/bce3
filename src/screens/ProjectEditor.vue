<script setup>
import { ref, computed } from 'vue';
import { useProjectStore } from '../stores/project';
import { useRoute } from 'vue-router';
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
}

const blocks = computed(() => store.getContentBlocks(project.value))
</script>
<template>
    <div>
        <div>
            <div>轨道视图</div>
            <div v-for="block in blocks">
                {{ block.title }}
            </div>
        </div>
        <div>全局设置</div>
    </div>
</template>