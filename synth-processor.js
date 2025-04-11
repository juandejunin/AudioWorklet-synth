// synth-processor.js
class SynthProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      // Objeto para almacenar voces activas, usando el número MIDI como clave
      this.voices = {};
      // Recibir mensajes desde main.js
      this.port.onmessage = (event) => {
        const data = event.data;
        if (data.type === 'noteOn') {
          // Crear o actualizar una voz
          this.voices[data.note] = {
            frequency: data.frequency,
            gain: data.gain,
            phase: 0 // Iniciar fase en 0 para cada nueva nota
          };
        } else if (data.type === 'noteOff') {
          // Eliminar la voz
          delete this.voices[data.note];
        }
      };
    }
  
    process(inputs, outputs, parameters) {
      const output = outputs[0][0]; // Canal de salida (mono)
  
      // Inicializar la salida a 0
      for (let i = 0; i < output.length; i++) {
        output[i] = 0;
      }
  
      // Procesar cada voz activa
      for (let note in this.voices) {
        const voice = this.voices[note];
        for (let i = 0; i < output.length; i++) {
          // Generar onda senoidal para esta voz y sumarla a la salida
          output[i] += Math.sin(voice.phase) * voice.gain;
          voice.phase += (2 * Math.PI * voice.frequency) / sampleRate;
          // Evitar desbordamiento de fase
          if (voice.phase > 2 * Math.PI) {
            voice.phase -= 2 * Math.PI;
          }
        }
      }
  
      // Normalizar la salida para evitar clipping (dividir por número de voces)
      const voiceCount = Object.keys(this.voices).length;
      if (voiceCount > 0) {
        for (let i = 0; i < output.length; i++) {
          output[i] /= voiceCount;
        }
      }
  
      return true; // Mantener el procesador vivo
    }
  
    static get parameterDescriptors() {
      return [];
    }
  }
  
  registerProcessor('synth-processor', SynthProcessor);