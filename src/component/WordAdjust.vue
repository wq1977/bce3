<script setup>
import { ref, computed, onMounted, watch, getCurrentInstance } from 'vue';
import { useProjectStore } from '../stores/project';
const store = useProjectStore()
const props = defineProps(['from', 'to', 'projectid'])
const adjFrame = ref(0)
const cursorLeft = ref(-1)
const dragingIdx = ref(-1)
const project = computed(() => store.list.filter(p => p.id == props.projectid)[0])
const limitTo = computed(() => {
    const FRAME_LIMIT = 44100 * 50
    let total = 0
    for (let i = props.from; i <= props.to; i++) {
        if (project.value.words[i].start || project.value.words[i].end) {
            total += (project.value.words[i].end - project.value.words[i].start)
        } else if (project.value.words[i].frameLen) {
            total += project.value.words[i].frameLen
        }
        if (total > FRAME_LIMIT) {
            return i - 1
        }
    }
    return parseInt(props.to)
})

const limitwords = computed(() => {
    if (!limitTo.value) return [];
    return project.value.words.slice(props.from, limitTo.value + 1)
})


const canvas = ref(null)
const adjustor = ref(null)
function pos(frame) {
    if (limitTo.value < props.from) return;
    const c = canvas.value
    if (!c) return;
    const rect = c.getBoundingClientRect()
    const rootrect = adjustor.value.getBoundingClientRect()
    const canvasLeft = rect.left - rootrect.left
    const width = 600
    const total = project.value.words[limitTo.value].end - project.value.words[props.from].start
    const result = (frame - project.value.words[props.from].start) * width / total + canvasLeft
    return result
}

function dragStart(e, wordidx) {
    e.preventDefault();
    e.stopPropagation()
    dragingIdx.value = wordidx
    document.onmouseup = (e) => {
        e.preventDefault();
        e.stopPropagation()
        document.onmouseup = null;
        document.onmousemove = null;
        console.log('change x', adjFrame.value,e)
        if (adjFrame.value == 0) {
            if (e.button == 0) {
                store.setTag(project.value, props.from + wordidx, props.from + wordidx + 1, limitwords.value[wordidx].type == 'delete' ? '' : 'delete')
            } else if (e.button==2) {
                let firstDelete =  -1
                for (let i=limitwords.value.length;i>=0;i--) {
                    if (limitwords.value[i].type == 'delete'){
                        firstDelete =i ;
                        break
                    }
                }
                if (firstDelete>=0) {
                    store.setTag(project.value, props.from + firstDelete+1, props.from + wordidx + 1, limitwords.value[wordidx].type == 'delete' ? '' : 'delete')
                }
            }
            return
        }
        const origin = limitwords.value[wordidx].start
        const newvalue = origin + adjFrame.value

        limitwords.value[wordidx].start = newvalue
        if (wordidx < limitwords.value.length - 1) {
            limitwords.value[wordidx].end = limitwords.value[wordidx + 1].start
        }
        if (wordidx > 0) {
            limitwords.value[wordidx - 1].end = newvalue
        }

        adjFrame.value = 0
        dragingIdx.value = -1
        cursorLeft.value = -1
        store.playWordsRaw(project.value, props.from + wordidx, props.to)
        store.saveWords(project.value)
    };
    document.onmousemove = (e) => {
        e.preventDefault();
        e.stopPropagation()
        const originPos = pos(limitwords.value[wordidx].start)
        const rect = canvas.value.getBoundingClientRect()
        const newPos = e.clientX - rect.left;
        console.log('new pos', newPos, originPos, rect)
        const width = rect.width
        const total = limitwords.value[limitwords.value.length - 1].end - limitwords.value[0].start
        adjFrame.value = Math.round((newPos - originPos) * total / width)
        cursorLeft.value = newPos
    };
}

async function drawFrame() {
    if (!limitwords.value || !limitwords.value.length) return;
    const buffer = await store.getWordsBuffer(project.value, props.from, limitTo.value)
    console.log('get words buffer', buffer)
    if (!buffer) return;
    var leftChannel = buffer.getChannelData(0);
    const context = canvas.value.getContext('2d')
    const dpr = window.devicePixelRatio
    console.log('dpr is', dpr,'canvas width is', canvas.value.width)
    const logicalWidth = 600
    const logicalHeight = 90
    canvas.value.width = logicalWidth * dpr
    canvas.value.height = logicalHeight * dpr
    canvas.value.style.width = logicalWidth + 'px'
    canvas.value.style.height = logicalHeight + 'px'
    context.scale(dpr, dpr)
    const width = logicalWidth // canvas.value.width
    const height = logicalHeight // canvas.value.height
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'black';
    context.lineWidth = 1;
    context.translate(0, height / 2);
    let maxAbs = 0
    for (var i = 0; i < leftChannel.length; i++) {
        if (Math.abs(leftChannel[i]) > maxAbs) {
            maxAbs = Math.abs(leftChannel[i])
        }
    }
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(width, 0);
    context.stroke();

    let scaleY = 0.7 / maxAbs
    for (var i = 0; i < leftChannel.length; i++) {
        // on which line do we get ?
        var x = Math.floor(width * i / leftChannel.length);
        var y = leftChannel[i] * scaleY * height / 2;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + 1, y);
        context.stroke();
    }
    context.restore();
}

function clickWord(w) {
    console.log(w)
}

onMounted(() => {
    drawFrame()
})

</script>
<template>
    <div ref="adjustor" class="relative z-50" @click.stop.prevent="() => { }">
        <canvas ref="canvas" width="600" height="90"></canvas>
        <span class="absolute cursor-pointer select-none data-[tag=delete]:line-through data-[tag=delete]:text-red-600"
            @mousedown="dragStart($event, idx)" :data-tag="word.type || 'normal'"
            :style="{ left: `${pos(word.start + (idx == dragingIdx ? adjFrame : 0))}px` }"
            v-for="(word, idx) in limitwords">{{
                word.word }}</span>
        <div v-if="cursorLeft > 0" :style="{ left: `${cursorLeft}px` }"
            class="absolute left-[100px] w-[2px] bg-red-600 h-[80px] top-[10px]"></div>
    </div>
</template>