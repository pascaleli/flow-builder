<template>
  <div class="tech-error-notification">
    <div v-for="(ajvError, key) in validationErrors" :key="key">
      <h6>
        <b>#{{ key + 1 }} &nbsp;</b>
        <b>{{ trans('flow-builder.location') }}</b>: {{ ajvError.dataPath }}, <b>{{ trans('flow-builder.message') }}</b>: {{ ajvError.message }}
        <a :aria-controls="`collapse_${errorType}_${key}`"
           :href="`#collapse_${errorType}_${key}`"
           aria-expanded="false"
           data-toggle="collapse"
           role="button">
          See details
        </a>
      </h6>

      <div :id="`collapse_${errorType}_${key}`" class="collapse">
        <div class="card card-body">
          {{ ajvError }}
        </div>
      </div>
    </div>

  </div>
</template>

<script>

import Lang from '@/lib/filters/lang'

export default {
  name: 'TechErrorNotifications',
  props: {
    validationErrors: {
      type: Array,
      required: true,
    },
    errorType: {
      type: String,
      required: true,
    },
  },
  mixins: [Lang],
}
</script>

<style scoped>

</style>
