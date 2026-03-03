<script setup>
import { watch } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  countdown: Number
})

const emit = defineEmits(['update:modelValue', 'cancelWarning'])

const closeDialog = () => {
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (val) => {
  if (!val) {
    setTimeout(() => emit('cancelWarning'), 300)
  }
})
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    persistent
    transition="dialog-top-transition"
    :style="{ zIndex: 10001 }"
  >
    <v-card rounded="xl">
      <v-card-title class="text-h4 font-weight-bold py-4 text-center">
        {{ $t('warning') }}
      </v-card-title>

      <v-card-text class="text-center px-8">
        <div class="text-h6 font-weight-bold mb-8">
          {{ $t('session') }}
        </div>
        <div class="text-h4 font-weight-bold text-red">
          {{ countdown }}
        </div>
      </v-card-text>

      <v-card-actions class="justify-center">
        <v-btn
          color="red"
          variant="flat"
          height="50"
          width="295"
          rounded="lg"
          class="font-weight-bold text-white mb-6"
          @click="closeDialog"
        >
          {{ $t('button') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>