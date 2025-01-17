<template>
  <div class="plain-draggable">
    <slot />
  </div>
</template>

<script lang="ts">
import {mixins} from 'vue-class-component'
import {Component, Prop, Watch} from 'vue-property-decorator'
import PlainDraggableLib from 'plain-draggable'
import Lang from '@/lib/filters/lang'
import {IPositionLeftTop} from '@/lib/types'
import {namespace} from 'vuex-class'

const builderNamespace = namespace('builder')

@Component({})
export class PlainDraggable extends mixins(Lang) {
  @Prop(Number) startX?: number
  @Prop(Number) startY?: number
  @Prop({type: Boolean, required: true}) isEditable!: boolean
  @Prop(String) dragHandleId?: string

  // The plain-draggable library has no types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  draggable: any = null

  @Watch('isEditable')
  onToggleEditable(value: boolean): void {
    this.draggable.disabled = !value
  }

  mounted(): void {
    // todo: modify this to instantiate blank draggable onCreate, then set options when props change
    console.debug('PlainDraggable.vue', 'mounted')

    // this.$nextTick(() => {

    this.draggable = new PlainDraggableLib(this.$el, this.plainDraggableLibOptions)
    // draggable.rect.{left,top,x,y,...}

    // todo: why this doesn't work?

    // this.draggable.snap = {x: 50, y: 50, width: 50, height: 50}
    // this.draggable.snap = {step: 21}

    this.handleInitialized()
    // })
  }

  updated(): void {
    this.draggable.setOptions(this.plainDraggableLibOptions)
  }

  get plainDraggableLibOptions(): Record<string, unknown> {
    const handle = this.dragHandleId !== undefined
      ? document.getElementById(this.dragHandleId)
      : this.$el.querySelectorAll('.draggable-handle')[0]

    return {
      containment: document.querySelector('.builder-canvas'),
      autoScroll: true,

      // prevent css translate() animations for move
      // they don't seem to be throttled enough for leaderline to follow tightly
      leftTop: false,
      // synced with src/store/builder/index.ts:isEditable=true
      disabled: false,
      onDrag: this.handleDragged.bind(this),
      onDragStart: this.handleDragStarted.bind(this),
      onDragEnd: this.handleDragEnded.bind(this),
      // onMove: this.handleMoved.bind(this),
      left: this.startX,
      top: this.startY,

      handle,
    }
  }

  destroyed(): void {
    const {draggable} = this
    this.$emit('destroyed', {draggable})
    this.draggable?.remove()
  }

  handleInitialized(): void {
    const {draggable} = this
    // `draggable` reference to reposition if changed externally like:
    // https://www.npmjs.com/package/plain-draggable#position
    this.$emit('initialized', {draggable})
  }

  handleDragged(position: IPositionLeftTop): void {
    const {draggable} = this
    this.$emit('dragged', {draggable, position})
  }

  handleDragStarted(position: IPositionLeftTop): void {
    const {draggable} = this
    this.$emit('dragStarted', {draggable, position})
  }

  // handleMoved(position): void {
  //   const {draggable} = this
  //   this.$emit('moved', {draggable, position})
  // }

  handleDragEnded(position: IPositionLeftTop): void {
    const {draggable} = this
    this.$emit('dragEnded', {draggable, position})
  }
}

export default PlainDraggable
</script>
