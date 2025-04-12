// // synth-processor.js
// class SynthProcessor extends AudioWorkletProcessor {
//     constructor() {
//       super();
//       // Objeto para almacenar voces activas, usando el número MIDI como clave
//       this.voices = {};
//       // Recibir mensajes desde main.js
//       this.port.onmessage = (event) => {
//         const data = event.data;
//         if (data.type === 'noteOn') {
//           // Crear o actualizar una voz
//           this.voices[data.note] = {
//             frequency: data.frequency,
//             gain: data.gain,
//             phase: 0 // Iniciar fase en 0 para cada nueva nota
//           };
//         } else if (data.type === 'noteOff') {
//           // Eliminar la voz
//           delete this.voices[data.note];
//         }
//       };
//     }
  
//     process(inputs, outputs, parameters) {
//       const output = outputs[0][0]; // Canal de salida (mono)
  
//       // Inicializar la salida a 0
//       for (let i = 0; i < output.length; i++) {
//         output[i] = 0;
//       }
  
//       // Procesar cada voz activa
//       for (let note in this.voices) {
//         const voice = this.voices[note];
//         for (let i = 0; i < output.length; i++) {
//           // Generar onda senoidal para esta voz y sumarla a la salida
//           output[i] += Math.sin(voice.phase) * voice.gain;
//           voice.phase += (2 * Math.PI * voice.frequency) / sampleRate;
//           // Evitar desbordamiento de fase
//           if (voice.phase > 2 * Math.PI) {
//             voice.phase -= 2 * Math.PI;
//           }
//         }
//       }
  
//       // Normalizar la salida para evitar clipping (dividir por número de voces)
//       const voiceCount = Object.keys(this.voices).length;
//       if (voiceCount > 0) {
//         for (let i = 0; i < output.length; i++) {
//           output[i] /= voiceCount;
//         }
//       }
  
//       return true; // Mantener el procesador vivo
//     }
  
//     static get parameterDescriptors() {
//       return [];
//     }
//   }
  
//   registerProcessor('synth-processor', SynthProcessor);



// synth-processor.js
class SynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = {};
    this.port.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'noteOn') {
        this.voices[data.note] = {
          frequency: data.frequency,
          baseGain: Math.max(0, Math.min(1, data.gain)),
          phase: 0,
          state: 'attack',
          time: 0,
          attack: Math.max(data.attack || 0.05, 0.001),
          decay: Math.max(data.decay || 0.1, 0.001),
          sustainLevel: Math.max(0, Math.min(1, data.sustainLevel || 0.8)),
          release: Math.max(data.release || 0.3, 0.001),
          noteOffTime: null
        };
        this.port.postMessage({
          type: 'debug',
          note: data.note,
          state: 'attack',
          gain: data.gain,
          frequency: data.frequency,
          time: 0
        });
      } else if (data.type === 'noteOff') {
        if (this.voices[data.note]) {
          this.voices[data.note].state = 'release';
          this.voices[data.note].noteOffTime = this.voices[data.note].time;
          this.port.postMessage({
            type: 'debug',
            note: data.note,
            state: 'release',
            time: this.voices[data.note].time
          });
        }
      }
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0][0];
    const sampleRate = this.sampleRate > 0 ? this.sampleRate : 44100; // Corregir typo
    const blockTime = output.length / sampleRate;

    // Inicializar la salida
    for (let i = 0; i < output.length; i++) {
      output[i] = 0;
    }

    // Procesar voces
    for (let note in this.voices) {
      const voice = this.voices[note];
      let envelopeGain = 0;

      // Calcular ganancia para el bloque
      if (voice.state === 'attack') {
        envelopeGain = voice.time / voice.attack;
        if (voice.time >= voice.attack) {
          voice.state = 'decay';
          voice.time = 0;
          this.port.postMessage({
            type: 'debug',
            note: note,
            state: 'decay',
            envelopeGain: envelopeGain,
            time: voice.time
          });
        }
      } else if (voice.state === 'decay') {
        envelopeGain = 1 - (1 - voice.sustainLevel) * (voice.time / voice.decay);
        if (voice.time >= voice.decay) {
          voice.state = 'sustain';
          voice.time = 0;
          this.port.postMessage({
            type: 'debug',
            note: note,
            state: 'sustain',
            envelopeGain: envelopeGain,
            time: voice.time
          });
        }
      } else if (voice.state === 'sustain') {
        envelopeGain = voice.sustainLevel;
      } else if (voice.state === 'release') {
        const timeSinceRelease = voice.time - (voice.noteOffTime || 0);
        envelopeGain = voice.sustainLevel * (1 - timeSinceRelease / voice.release);
        if (timeSinceRelease >= voice.release || envelopeGain <= 0) {
          delete this.voices[note];
          this.port.postMessage({
            type: 'debug',
            note: note,
            state: 'deleted',
            time: voice.time
          });
          continue;
        }
      }

      // Asegurar que envelopeGain sea válido
      envelopeGain = Math.max(0, Math.min(1, envelopeGain));
      if (isNaN(envelopeGain) || isNaN(voice.frequency) || isNaN(voice.phase)) {
        this.port.postMessage({
          type: 'debug',
          note: note,
          state: voice.state,
          error: 'Invalid value detected',
          envelopeGain: envelopeGain,
          frequency: voice.frequency,
          phase: voice.phase,
          time: voice.time
        });
        delete this.voices[note];
        continue;
      }

      // Generar onda para todo el bloque
      for (let i = 0; i < output.length; i++) {
        const gain = voice.baseGain * envelopeGain;
        const sample = Math.sin(voice.phase) * gain;
        output[i] += sample;
        voice.phase += (2 * Math.PI * voice.frequency) / sampleRate;
        if (voice.phase > 2 * Math.PI) {
          voice.phase -= 2 * Math.PI;
        }

        // Depuración de la salida (enviar solo para la primera muestra)
        if (i === 0) {
          this.port.postMessage({
            type: 'debug',
            note: note,
            state: voice.state,
            sample: sample,
            output: output[i],
            gain: gain,
            phase: voice.phase,
            time: voice.time
          });
        }
      }

      // Actualizar tiempo al final del bloque
      voice.time += blockTime;
    }

    // Normalización conservadora
    const voiceCount = Object.keys(this.voices).length;
    if (voiceCount > 0) {
      for (let i = 0; i < output.length; i++) {
        output[i] = output[i] * 0.4; // Ajustar escala para volumen claro
      }
    }

    return true;
  }

  static get parameterDescriptors() {
    return [];
  }
}

registerProcessor('synth-processor', SynthProcessor);