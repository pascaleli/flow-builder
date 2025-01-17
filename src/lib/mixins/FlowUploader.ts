import Vue from 'vue'
import {chain, extend} from 'lodash'
import Component from 'vue-class-component'

// For now, we're using flowjs 2.0.0 to match with existing backend server of Viamo
// see readme to see an example of resumeableAudioUpload() controller implementation to handle GET & POST requests from flowjs
import Flow from '@flowjs/flow.js'

const dispatch = (el: HTMLElement, name: string, data: {}): void => {
  el.dispatchEvent(extend(new Event(name, {
    bubbles: true,
    cancelable: true,
  }), {data}))
}

@Component({
  directives: {
    'flow-uploader': {
      /**
       * This binding provides a bridge between Flow and vuejs such that we can continue using our resumable backend
       */
      bind(el, binding) {
        const {
          accept,
          target,
          token: upload_token,
        } = binding.value
        const uploader = new Flow({
          target,
          singleFile: true,
          // kbytes, chunked?  ¯\_(ツ)_/¯
          chunkSize: 1024 * 512,
          query: {upload_token},
        })

        if (!uploader.support) {
          // Your browser doesn't support HTML5 uploads; please try Firefox or Chrome.
          return
        }

        extend(el.style, {overflow: 'hidden'})
        uploader.assignBrowse([el])

        // eslint-disable-next-line lodash/chaining
        chain(el.children)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          .find({
            tagName: 'INPUT',
            type: 'file',
          } as any)
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore: Property 'accept' does not exist on type
          .assign({accept})
          .value()

        // todo: migrate to proxied catch-all handler (voto5 legacy todo)
        // uploader.on('catchAll', (name, file/*or files*/, e) => console.debug(name))

        // todo: when do we call upload on a multiselect-upload and file-added triggered multiple times? (voto5 legacy todo)
        // uploader.upload()
        // uploader.on('fileAdded', (file, e) => dispatch(el, 'filesSubmitted', {file, uploader}))
        uploader.on('filesSubmitted', (files: any, _even: any) => dispatch(el, 'filesSubmitted', {
          files,
          uploader,
          // uploader.upload()
        }))
        uploader.on('fileProgress', (file: any, _event: any) => dispatch(el, 'fileProgress', {
          file,
          uploader,
        }))
        uploader.on('fileSuccess', (file: any, json: any) => dispatch(el, 'fileSuccess', {
          file,
          uploader,
          json,
          // uploader.cancel()
        }))
        uploader.on('error', (message: any, file: any) => dispatch(el, 'fileError', {
          file,
          uploader,
          message,
          // uploader.cancel()
        }))
      },

      // unbind(el, binding) {
      // },
    },
  },
})
export default class FlowUploader extends Vue {}
