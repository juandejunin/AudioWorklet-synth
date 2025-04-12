// // main.js
// let audioContext;
// let synthNode;
// let isAudioInitialized = false;

// // Inicializar AudioWorklet
// async function initAudio() {
//   try {
//     audioContext = new AudioContext({ latencyHint: 'interactive' });
//     await audioContext.resume(); // Asegurar que el contexto esté activo
//     await audioContext.audioWorklet.addModule('synth-processor.js');
//     synthNode = new AudioWorkletNode(audioContext, 'synth-processor');
//     synthNode.connect(audioContext.destination); // Conectar al destino (altavoces)
//     isAudioInitialized = true;
//     document.getElementById('audio-status').textContent = 'Audio listo';
//     console.log('Audio inicializado correctamente');
//   } catch (err) {
//     console.error('Error al inicializar audio:', err);
//     document.getElementById('audio-status').textContent = 'Error en audio';
//   }
// }

// // Convertir nota MIDI a frecuencia
// function midiToFrequency(note) {
//   return 440 * Math.pow(2, (note - 69) / 12); // A4 = 440 Hz, nota MIDI 69
// }

// // Tocar una nota
// function playNote(note, velocity) {
//   if (!isAudioInitialized || !synthNode) {
//     console.error('SynthNode no está inicializado. Haz clic para activar el audio.');
//     return;
//   }
//   const frequency = midiToFrequency(note);
//   const gain = velocity / 127; // Normalizar velocidad a 0-1
//   synthNode.port.postMessage({ type: 'noteOn', note, frequency, gain });
//   console.log(`Tocando nota: ${note}, frecuencia: ${frequency}, gain: ${gain}`);
// }

// // Detener una nota
// function stopNote(note) {
//   if (!isAudioInitialized || !synthNode) return;
//   synthNode.port.postMessage({ type: 'noteOff', note });
//   console.log(`Nota detenida: ${note}`);
// }

// // Manejar mensajes MIDI
// function handleMIDIMessage(message) {
//   const [command, note, velocity] = message.data;
//   const noteStatus = document.getElementById('note-status');

//   // Note On (comando 144)
//   if (command === 144 && velocity > 0) {
//     noteStatus.textContent = `Nota: ${note}, Velocidad: ${velocity}`;
//     playNote(note, velocity);
//   }
//   // Note Off (comando 128 o Note On con velocidad 0)
//   else if (command === 128 || (command === 144 && velocity === 0)) {
//     noteStatus.textContent = 'Ninguna';
//     stopNote(note);
//   }
// }

// // Inicializar MIDI
// async function initMIDI() {
//   try {
//     const midiAccess = await navigator.requestMIDIAccess();
//     document.getElementById('midi-status').textContent = 'MIDI conectado';
//     console.log('MIDI conectado');

//     // Obtener todas las entradas MIDI
//     const inputs = midiAccess.inputs.values();
//     for (let input of inputs) {
//       input.onmidimessage = handleMIDIMessage;
//       console.log('Entrada MIDI detectada:', input.name);
//     }

//     // Manejar cambios en conexiones MIDI
//     midiAccess.onstatechange = (event) => {
//       console.log('Estado MIDI cambiado:', event.port.name, event.port.state);
//       document.getElementById('midi-status').textContent =
//         event.port.state === 'connected' ? 'MIDI conectado' : 'MIDI desconectado';
//     };
//   } catch (err) {
//     console.error('Error al conectar MIDI:', err);
//     document.getElementById('midi-status').textContent = 'Error MIDI';
//   }
// }

// // Iniciar todo al cargar
// window.onload = async () => {
//   // Inicializar MIDI inmediatamente, ya que no requiere interacción
//   await initMIDI();

//   // Configurar el botón para tocar la nota de prueba y activar audio
//   const playButton = document.getElementById('play-note');
//   playButton.addEventListener('click', async () => {
//     if (!isAudioInitialized) {
//       await initAudio(); // Inicializar audio en el primer clic
//     }
//     playNote(60, 100); // Nota C4 (MIDI 60), velocidad 100
//     // Detener la nota después de 1 segundo
//     setTimeout(() => {
//       stopNote(60);
//       document.getElementById('note-status').textContent = 'Ninguna';
//     }, 1000);
//   });
// };


// main.js
let audioContext;
let synthNode;
let isAudioInitialized = false;

async function initAudio() {
  try {
    audioContext = new AudioContext({ latencyHint: 'interactive' });
    await audioContext.resume();
    await audioContext.audioWorklet.addModule('synth-processor.js');
    synthNode = new AudioWorkletNode(audioContext, 'synth-processor');
    synthNode.connect(audioContext.destination);
    synthNode.port.onmessage = (event) => {
      console.log('Mensaje desde AudioWorklet:', JSON.stringify(event.data, null, 2));
    };
    isAudioInitialized = true;
    document.getElementById('audio-status').textContent = 'Audio listo';
    console.log('Audio inicializado correctamente');
  } catch (err) {
    console.error('Error al inicializar audio:', err);
    document.getElementById('audio-status').textContent = 'Error en audio';
  }
}

function midiToFrequency(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function playNote(note, velocity) {
  if (!isAudioInitialized || !synthNode) {
    console.error('SynthNode no está inicializado. Haz clic para activar el audio.');
    return;
  }
  const frequency = midiToFrequency(note);
  const gain = velocity / 127;
  synthNode.port.postMessage({
    type: 'noteOn',
    note,
    frequency,
    gain,
    attack: 0.05,
    decay: 0.1,
    sustainLevel: 0.8,
    release: 0.3
  });
  console.log(`Tocando nota: ${note}, frecuencia: ${frequency}, gain: ${gain}`);
}

function stopNote(note) {
  if (!isAudioInitialized || !synthNode) return;
  synthNode.port.postMessage({ type: 'noteOff', note });
  console.log(`Nota detenida: ${note}`);
}

function handleMIDIMessage(message) {
  const [command, note, velocity] = message.data;
  const noteStatus = document.getElementById('note-status');

  if (command === 144 && velocity > 0) {
    noteStatus.textContent = `Nota: ${note}, Velocidad: ${velocity}`;
    playNote(note, velocity);
  } else if (command === 128 || (command === 144 && velocity === 0)) {
    noteStatus.textContent = 'Ninguna';
    stopNote(note);
  }
}

async function initMIDI() {
  try {
    const midiAccess = await navigator.requestMIDIAccess();
    document.getElementById('midi-status').textContent = 'MIDI conectado';
    console.log('MIDI conectado');

    const inputs = midiAccess.inputs.values();
    for (let input of inputs) {
      input.onmidimessage = handleMIDIMessage;
      console.log('Entrada MIDI detectada:', input.name);
    }

    midiAccess.onstatechange = (event) => {
      console.log('Estado MIDI cambiado:', event.port.name, event.port.state);
      document.getElementById('midi-status').textContent =
        event.port.state === 'connected' ? 'MIDI conectado' : 'MIDI desconectado';
    };
  } catch (err) {
    console.error('Error al conectar MIDI:', err);
    document.getElementById('midi-status').textContent = 'Error MIDI';
  }
}

window.onload = async () => {
  await initMIDI();

  const playButton = document.getElementById('play-note');
  playButton.addEventListener('click', async () => {
    if (!isAudioInitialized) {
      await initAudio();
    }
    playNote(60, 100);
    setTimeout(() => {
      stopNote(60);
      document.getElementById('note-status').textContent = 'Ninguna';
    }, 1000);
  });
};