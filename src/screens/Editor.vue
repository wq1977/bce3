<script setup>
import { ref, computed, watch } from 'vue'
import Draggable from 'vuedraggable'
import { Icon } from '@iconify/vue'
import { useRoute } from 'vue-router';
import { useProjectStore } from '../stores/project';
const store = useProjectStore()
const route = useRoute()
const paraRefs = ref(null)
const project = ref(null);
if (!store.list.length) {
    store.load().then(init)
} else {
    init()
}

watch(() => project.value && project.value.paragraphs, () => {
    console.log('project paragraphs changed')
})
const titlelist = computed({
    get: () => {
        if (!project.value) return []
        if (!project.value.paragraphs) return [];

        const result = []
        for (let index = 0; index < project.value.paragraphs.length; index++) {
            const p = project.value.paragraphs[index];
            if (p.comment) {
                result.push({
                    title: p.comment,
                    index,
                    sequence: p.sequence
                })
            }
        }
        const list = result.sort((a, b) =>
            (a.sequence || a.index) - (b.sequence || b.index)
        )
        return list

    },
    set: (list) => {
        list.forEach((p, idx) => {
            project.value.paragraphs[p.index].sequence = idx + 1
        })
        store.saveParagraph(project.value)
    }
})

async function init() {
    project.value = store.list.filter(p => p.id == route.query.id)[0]
    await store.prepare(project.value)
}

async function setComment(event, paragraphIdx) {
    const text = event.target.textContent.trim()
    if (text || paragraphIdx == 0) {
        project.value.paragraphs[paragraphIdx].comment = text
        store.saveParagraph(project.value);
    } else {
        store.mergeBackParagraph(project.value, paragraphIdx)
    }
}

function preventEnter(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        e.target.blur()
    }
}

function paragraphKeyDown(e, paragraphIdx, piece) {
    if (e.code == 'Enter') {
        const position = getSelection().baseOffset
        store.splitParagraph(project.value, paragraphIdx, piece, position)
    }
}

let seed = 10000
function randomKey() {
    return `${Math.random()}-${seed++}`
}

</script>
<template>
    <div v-if="project">
        <h1>Editor -- {{ project.name }}</h1>
        <div class="mr-[280px]">
            <div ref="paraRefs" v-for="(paragraph, idx) in project.paragraphs"
                class="text-justify leading-relaxed p-2 focus:outline-none " :key="paragraph.start">
                <span contenteditable @keydown="preventEnter" @blur="setComment($event, idx)"
                    class="text-red-600 mr-2 px-1">
                    {{ `${paragraph.comment || '无注释'}` }}</span>
                <Icon @click="store.playParagraph(project, idx)" icon="zondicons:play-outline" class="inline mr-2" />
                <span v-for="piece in paragraph.pieces" @keydown="paragraphKeyDown($event, idx, piece)" tabindex="0"
                    class="focus:outline-none"> {{
                        piece.text }} </span>
            </div>
        </div>
        <div v-if="store.stop" class="fixed right-1 bottom-1">
            <button @click="() => { store.stop(); store.stop = null }"
                class="w-[70px] h-[70px] rounded-full border-2 hover:bg-gray-600 bg-gray-600/70 text-white">stop</button>
        </div>
    </div>
    <div class="fixed right-[20px] top-[20px]  ">
        <Draggable v-model="titlelist" item-key="title">
            <template #item="{ element }">
                <div
                    class="bg-gray-100 cursor-grab border-2 mb-1 rounded p-2 w-[240px] text-ellipsis overflow-hidden whitespace-nowrap">
                    {{ element.title }}</div>
            </template>
        </Draggable>
    </div>
</template>