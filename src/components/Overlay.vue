<script setup>
import { ref, computed } from 'vue'
import { Vue3Lottie } from 'vue3-lottie'
import ScanQR from '@/assets/animations/ScanQR.json'
import ScanSF from '@/assets/animations/ScanSF.json'
import Load from '@/assets/animations/Load.json'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const props = defineProps({
    visible: Boolean,
    animation: {
        type: String,
        default: 'ScanQR',
    },
    allowCancel: { type: Boolean, default: true }
})

const emit = defineEmits(['close'])

const animationToShow = computed(() =>
    props.animation === 'ScanSF' ? ScanSF : props.animation === 'Load' ? Load : ScanQR
)
const textRef = ref(null)
const isVisible = ref(false)
let observer = null

const splitText = computed(() => {
  return t('qr.escanea').split('')
})
const initializeTextAnimation = () => {
    if (!textRef.value) return
    
    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isVisible.value) {
                setTimeout(() => {
                    isVisible.value = true
                }, 300)
            }
        })
    }, {
        threshold: 0.1
    })

    observer.observe(textRef.value)
}
const cleanup = () => {
    if (observer) {
        observer.disconnect()
        observer = null
    }
    isVisible.value = false
}

const handleVisibilityChange = () => {
    if (props.visible) {
        setTimeout(() => {
            initializeTextAnimation()
        }, 100)
    } else {
        cleanup()
    }
}

const closeOverlay = () => {
    emit('close')
}

watch(() => props.visible, handleVisibilityChange, { immediate: true })
</script>

<template>
    <div v-if="visible" class="overlay">
        <div class="content">
            <div class="animation-container">
                <Vue3Lottie
                    :animationData="animationToShow"
                    :loop="true"
                    :autoplay="true"
                    style="width: 500px; height: 500px"
                />
                <div
                    v-if="animation === 'ScanQR'"
                    ref="textRef"
                    class="split-text-container"
                >
                    <span 
                        v-for="(char, index) in splitText"
                        :key="index"
                        :class="['split-char', { 'is-visible': isVisible }]"
                        :style="{
                            transitionDelay: `${index * 10}ms`
                        }"
                    >
                        {{ char === ' ' ? '\u00A0' : char }}
                    </span>
                </div>
            </div>
            <button @click="closeOverlay" class="cancel-button" v-if="props.allowCancel">
                {{ t('common.cancelar') }}
            </button>
        </div>
    </div>
</template>

<style scoped>
.overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.85);
    z-index: 9999;
    display: flex;
    align-items: center;
    z-index: 9999 !important;
    justify-content: center;
}

.content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    height: 100%;
    width: 100%;
    position: relative;
}

.animation-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.split-text-container {
    margin-top: 30px;
    font-size: 2.5rem;
    font-weight: 700;
    color: white;
    text-align: center;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

.split-char {
    display: inline-block;
    opacity: 0;
    transform: translateY(40px);
    transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.split-char.is-visible {
    opacity: 1;
    transform: translateY(0);
}

.split-char:hover {
    transform: translateY(-3px) scale(1.05);
    text-shadow: 0 5px 15px rgba(255, 255, 255, 0.3);
}

.cancel-button {
    position: absolute;
    bottom: 350px;
    padding: 12px 40px;
    font-size: 1.2rem;
    font-weight: 600;
    color: white;
    background-color: rgba(220, 38, 38, 0.8);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.cancel-button:hover {
    background-color: rgba(220, 38, 38, 1);
    border-color: rgba(255, 255, 255, 0.6);
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(220, 38, 38, 0.4);
}

.cancel-button:active {
    transform: translateY(0);
}
</style>