import { useState, useCallback, useRef } from 'react'
import P5Sketch from '../../core/p5/P5Sketch'
import PythonCell from '../../components/viz/PythonCell'
import ControlPanel from '../../components/viz/ControlPanel'
import type { LessonMeta } from '../../types'
import type p5 from 'p5'

export const meta: LessonMeta = {
  id: 'systems/encoding',
  title: 'Encoding & Evolution',
  description: 'How data is serialized for storage and transmission, and how schemas evolve over time while maintaining forward and backward compatibility',
  track: 'systems',
  order: 4,
  tags: ['encoding', 'serialization', 'protobuf', 'avro', 'schema-evolution', 'compatibility'],
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface FieldDef {
  tag: number
  name: string
  type: string
  value: string | number | boolean
}

const SAMPLE_RECORD: FieldDef[] = [
  { tag: 1, name: 'userName', type: 'string', value: 'Martin' },
  { tag: 2, name: 'favoriteNumber', type: 'int64', value: 1337 },
  { tag: 3, name: 'interests', type: 'string[]', value: 'daydreaming' },
]

function jsonByteSize(record: FieldDef[]): number {
  const obj: Record<string, string | number | boolean> = {}
  for (const f of record) obj[f.name] = f.value
  return new TextEncoder().encode(JSON.stringify(obj)).length
}

function binaryByteSize(record: FieldDef[]): number {
  let bytes = 0
  for (const f of record) {
    bytes += 1 // field tag (varint)
    bytes += 1 // wire type
    if (f.type === 'string' || f.type === 'string[]') {
      const len = typeof f.value === 'string' ? f.value.length : 0
      bytes += 1 // length prefix
      bytes += len
    } else {
      bytes += varIntSize(typeof f.value === 'number' ? f.value : 0)
    }
  }
  return bytes
}

function varIntSize(n: number): number {
  if (n === 0) return 1
  let count = 0
  let v = Math.abs(n)
  while (v > 0) { count++; v = Math.floor(v / 128) }
  return count
}

function toHexBytes(s: string): string[] {
  return Array.from(new TextEncoder().encode(s)).map(b => b.toString(16).padStart(2, '0'))
}

function numberToVarIntHex(n: number): string[] {
  if (n === 0) return ['00']
  const result: string[] = []
  let v = n
  while (v > 0) {
    let byte = v & 0x7f
    v = v >>> 7
    if (v > 0) byte |= 0x80
    result.push(byte.toString(16).padStart(2, '0'))
  }
  return result
}

/* ================================================================== */
/*  Section 1 -- Why Encoding Matters                                  */
/* ================================================================== */
function WhyEncodingSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Why Encoding Matters</h2>
      <p className="text-gray-300 leading-relaxed">
        In-memory data structures -- objects, hash maps, trees, structs -- are optimized for efficient
        access and manipulation by the CPU. But the moment you need to write data to a file, send it
        over the network, or store it in a database, you must encode it as a self-contained sequence
        of bytes. This process goes by many names: <strong className="text-white">serialization</strong>,
        <strong className="text-white"> marshalling</strong>, or <strong className="text-white">encoding</strong>.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The choice of encoding format has far-reaching consequences. It affects storage size, parsing
        speed, human readability, and -- critically -- <strong className="text-white">schema evolution</strong>.
        In any real system, data formats change over time. New fields are added, old fields are removed,
        types change. During a rolling upgrade, you may have old and new code running simultaneously,
        reading and writing data in different schema versions. Your encoding must handle this gracefully.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Two key properties govern safe schema evolution:
      </p>
      <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
        <li>
          <strong className="text-white">Backward compatibility</strong> -- new code can read data written
          by old code. This is generally straightforward: new code knows about all old fields.
        </li>
        <li>
          <strong className="text-white">Forward compatibility</strong> -- old code can read data written
          by new code. This is trickier: old code must gracefully ignore fields it does not recognize.
        </li>
      </ul>
      <p className="text-gray-300 leading-relaxed">
        Without both properties, rolling deployments become impossible. You would need to take the entire
        system down, upgrade every node simultaneously, and restart -- a recipe for downtime.
      </p>
    </section>
  )
}

/* ================================================================== */
/*  Section 2 -- JSON vs Binary: Animated Comparison                   */
/* ================================================================== */
function JsonVsBinarySection() {
  const [animPhase, setAnimPhase] = useState<'idle' | 'json' | 'binary'>('idle')
  const stateRef = useRef({ phase: 'idle' as string, progress: 0 })

  const sketch = useCallback((p: p5) => {
    let progress = 0
    let currentPhase = 'idle'

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 760), 420)
      p.textFont('monospace')
    }

    p.draw = () => {
      const phase = stateRef.current.phase
      if (phase !== currentPhase) {
        currentPhase = phase
        progress = 0
      }
      if (currentPhase !== 'idle') {
        progress = Math.min(progress + 0.008, 1)
      }
      stateRef.current.progress = progress

      p.background(15, 15, 25)

      // Title
      p.fill(255)
      p.noStroke()
      p.textSize(14)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Encoding Format Comparison', 20, 12)

      // Source object
      const objX = 30
      const objY = 50
      p.fill(50, 60, 90)
      p.stroke(80, 130, 200)
      p.strokeWeight(1)
      p.rect(objX, objY, 220, 110, 8)

      p.fill(80, 180, 255)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text('In-Memory Object', objX + 10, objY + 8)

      p.fill(200)
      p.textSize(10)
      for (let i = 0; i < SAMPLE_RECORD.length; i++) {
        const f = SAMPLE_RECORD[i]
        p.text(`${f.name}: ${JSON.stringify(f.value)}`, objX + 14, objY + 30 + i * 22)
      }

      // Arrow
      const arrowStartX = objX + 230
      const arrowY = objY + 55
      p.stroke(100)
      p.strokeWeight(2)
      p.line(arrowStartX, arrowY, arrowStartX + 60, arrowY)
      p.fill(100)
      p.noStroke()
      p.triangle(arrowStartX + 60, arrowY - 5, arrowStartX + 60, arrowY + 5, arrowStartX + 70, arrowY)

      // JSON output
      const jsonX = 340
      const jsonY = 40
      const jsonBytes = jsonByteSize(SAMPLE_RECORD)

      p.fill(currentPhase === 'json' ? p.lerpColor(p.color(40, 50, 70), p.color(30, 90, 60), progress) : p.color(40, 50, 70))
      p.stroke(currentPhase === 'json' ? p.lerpColor(p.color(80, 100, 140), p.color(80, 200, 120), progress) : p.color(80, 100, 140))
      p.strokeWeight(1)
      p.rect(jsonX, jsonY, 380, 140, 8)

      p.fill(80, 200, 120)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`JSON (${jsonBytes} bytes)`, jsonX + 10, jsonY + 8)

      p.fill(200)
      p.textSize(10)
      const jsonStr = JSON.stringify(
        SAMPLE_RECORD.reduce((acc, f) => ({ ...acc, [f.name]: f.value }), {}),
        null, 2
      )
      const jsonLines = jsonStr.split('\n')
      const visibleLines = currentPhase === 'json' ? Math.ceil(jsonLines.length * progress) : jsonLines.length
      for (let i = 0; i < Math.min(visibleLines, jsonLines.length); i++) {
        p.text(jsonLines[i], jsonX + 14, jsonY + 28 + i * 14)
      }

      // Binary output
      const binX = 340
      const binY = 210
      const binBytes = binaryByteSize(SAMPLE_RECORD)

      p.fill(currentPhase === 'binary' ? p.lerpColor(p.color(40, 50, 70), p.color(90, 50, 30), progress) : p.color(40, 50, 70))
      p.stroke(currentPhase === 'binary' ? p.lerpColor(p.color(80, 100, 140), p.color(240, 160, 60), progress) : p.color(80, 100, 140))
      p.strokeWeight(1)
      p.rect(binX, binY, 380, 160, 8)

      p.fill(240, 160, 60)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Binary / Protobuf-style (${binBytes} bytes)`, binX + 10, binY + 8)

      // Render binary fields
      let byteOffset = 0
      const byteStartY = binY + 30
      for (let fi = 0; fi < SAMPLE_RECORD.length; fi++) {
        const f = SAMPLE_RECORD[fi]
        const row = fi
        const ry = byteStartY + row * 36
        const visibleThreshold = currentPhase === 'binary' ? progress * SAMPLE_RECORD.length : SAMPLE_RECORD.length

        if (fi < visibleThreshold) {
          // Tag byte
          p.fill(200, 100, 60)
          p.rect(binX + 14, ry, 24, 20, 3)
          p.fill(255)
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(`T${f.tag}`, binX + 26, ry + 10)

          // Type byte
          p.fill(100, 60, 200)
          p.rect(binX + 42, ry, 24, 20, 3)
          p.fill(255)
          p.text(f.type === 'string' || f.type === 'string[]' ? 'LEN' : 'VAR', binX + 54, ry + 10)

          // Value bytes
          let valueHex: string[]
          if (typeof f.value === 'string') {
            const lenHex = [f.value.length.toString(16).padStart(2, '0')]
            valueHex = [...lenHex, ...toHexBytes(f.value)]
          } else if (typeof f.value === 'number') {
            valueHex = numberToVarIntHex(f.value)
          } else {
            valueHex = ['00']
          }

          for (let bi = 0; bi < Math.min(valueHex.length, 18); bi++) {
            const bx = binX + 72 + bi * 18
            p.fill(60, 120, 80)
            p.rect(bx, ry, 16, 20, 2)
            p.fill(200, 255, 200)
            p.textSize(7)
            p.textAlign(p.CENTER, p.CENTER)
            p.text(valueHex[bi], bx + 8, ry + 10)
          }
          if (valueHex.length > 18) {
            p.fill(140)
            p.textSize(8)
            p.text('...', binX + 72 + 18 * 18, ry + 10)
          }
        }
        byteOffset += 2 + (typeof f.value === 'string' ? 1 + f.value.length : varIntSize(typeof f.value === 'number' ? f.value : 0))
      }

      // Size comparison bar
      const barY = 395
      const maxBarW = 300
      const jsonBarW = (jsonBytes / jsonBytes) * maxBarW
      const binBarW = (binBytes / jsonBytes) * maxBarW

      p.fill(80, 200, 120, 180)
      p.noStroke()
      p.rect(30, barY, jsonBarW * Math.min(progress * 2, 1), 10, 3)
      p.fill(240, 160, 60, 180)
      p.rect(30, barY + 14, binBarW * Math.min(progress * 2, 1), 10, 3)

      p.fill(200)
      p.textSize(10)
      p.textAlign(p.LEFT, p.CENTER)
      p.text(`JSON: ${jsonBytes}B`, 30 + maxBarW + 10, barY + 5)
      p.text(`Binary: ${binBytes}B`, 30 + maxBarW + 10, barY + 19)

      const savings = Math.round((1 - binBytes / jsonBytes) * 100)
      p.fill(240, 160, 60)
      p.textSize(11)
      p.text(`${savings}% smaller`, 30 + maxBarW + 100, barY + 12)
    }
  }, [])

  const handleAnimate = (phase: 'json' | 'binary') => {
    setAnimPhase(phase)
    stateRef.current.phase = phase
    stateRef.current.progress = 0
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">JSON, XML, and Binary Formats</h2>
      <p className="text-gray-300 leading-relaxed">
        JSON and XML are the lingua franca of data exchange. They are human-readable, widely supported,
        and self-describing. But these properties come at a cost: they are verbose. Field names are
        repeated in every record. Numbers are stored as decimal strings. Whitespace is significant in
        XML. A single record that takes 20 bytes in a compact binary format might take 80+ bytes in JSON.
      </p>
      <p className="text-gray-300 leading-relaxed">
        For systems that process millions or billions of records -- logs, metrics, event streams,
        database pages -- this overhead is unacceptable. Binary encoding formats like
        <strong className="text-white"> Protocol Buffers</strong>, <strong className="text-white">Thrift</strong>,
        and <strong className="text-white">Avro</strong> address this by encoding data compactly using
        schemas. Instead of repeating field names, they use numeric field tags. Instead of decimal strings,
        they use native integer encodings (varints). The result: dramatically smaller payloads and faster
        parsing.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Click the buttons below to animate the serialization process for each format. Watch how JSON
        includes field names as strings while the binary format uses compact numeric tags.
      </p>
      <P5Sketch
        sketch={sketch}
        height={420}
        controls={
          <ControlPanel title="Animate Serialization">
            <div className="flex gap-3">
              <button
                onClick={() => handleAnimate('json')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  animPhase === 'json' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Serialize to JSON
              </button>
              <button
                onClick={() => handleAnimate('binary')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  animPhase === 'binary' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Serialize to Binary
              </button>
            </div>
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 3 -- Protocol Buffers & Field Tags                         */
/* ================================================================== */
function ProtobufSection() {
  const [highlightField, setHighlightField] = useState(0)
  const stateRef = useRef({ highlightField: 0 })
  stateRef.current.highlightField = highlightField

  const sketch = useCallback((p: p5) => {
    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 760), 400)
      p.textFont('monospace')
    }

    p.draw = () => {
      const hl = stateRef.current.highlightField
      p.background(15, 15, 25)

      // Proto schema on the left
      const schemaX = 20
      const schemaY = 20
      p.fill(40, 45, 65)
      p.stroke(100, 130, 200)
      p.strokeWeight(1)
      p.rect(schemaX, schemaY, 320, 180, 8)

      p.fill(100, 180, 255)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('.proto Schema Definition', schemaX + 10, schemaY + 8)

      const protoLines = [
        'message Person {',
        '  string user_name      = 1;',
        '  int64  favorite_number = 2;',
        '  repeated string interests = 3;',
        '}',
      ]

      for (let i = 0; i < protoLines.length; i++) {
        const isHighlighted = (hl === 0 && i === 1) || (hl === 1 && i === 2) || (hl === 2 && i === 3)
        p.fill(isHighlighted ? p.color(255, 220, 80) : p.color(200))
        p.textSize(11)
        p.text(protoLines[i], schemaX + 14, schemaY + 32 + i * 22)

        if (isHighlighted) {
          p.noFill()
          p.stroke(255, 220, 80, 100)
          p.strokeWeight(1)
          p.rect(schemaX + 10, schemaY + 28 + i * 22, 296, 20, 3)
          p.noStroke()
        }
      }

      // Explanation
      p.fill(160)
      p.textSize(10)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Each field has a numeric TAG (1, 2, 3...) and a TYPE.', schemaX + 14, schemaY + 148)
      p.text('The tag, not the name, identifies the field on the wire.', schemaX + 14, schemaY + 162)

      // Binary encoding on the right
      const binX = 360
      const binY = 20
      p.fill(40, 45, 65)
      p.stroke(200, 140, 60)
      p.strokeWeight(1)
      p.rect(binX, binY, 370, 180, 8)

      p.fill(240, 160, 60)
      p.noStroke()
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Wire Format (Binary Bytes)', binX + 10, binY + 8)

      const fields = SAMPLE_RECORD
      for (let fi = 0; fi < fields.length; fi++) {
        const f = fields[fi]
        const ry = binY + 34 + fi * 44
        const isHl = fi === hl
        const alpha = isHl ? 255 : 100

        // Wire byte = (tag << 3) | wireType
        const wireType = f.type === 'string' || f.type === 'string[]' ? 2 : 0
        const wireByte = (f.tag << 3) | wireType

        // Tag+type composite byte
        p.fill(200, 100, 60, alpha)
        p.rect(binX + 14, ry, 50, 22, 3)
        p.fill(255, 255, 255, alpha)
        p.textSize(9)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`0x${wireByte.toString(16).padStart(2, '0')} (T${f.tag})`, binX + 39, ry + 11)

        // Arrow
        p.stroke(255, 255, 255, alpha * 0.4)
        p.strokeWeight(1)
        p.line(binX + 68, ry + 11, binX + 78, ry + 11)
        p.noStroke()

        // Value bytes
        let valueHex: string[]
        if (typeof f.value === 'string') {
          const strBytes = toHexBytes(f.value)
          valueHex = [f.value.length.toString(16).padStart(2, '0'), ...strBytes]
        } else if (typeof f.value === 'number') {
          valueHex = numberToVarIntHex(f.value)
        } else {
          valueHex = ['00']
        }

        for (let bi = 0; bi < Math.min(valueHex.length, 14); bi++) {
          const bx = binX + 82 + bi * 20
          p.fill(60, 120, 80, alpha)
          p.rect(bx, ry, 18, 22, 2)
          p.fill(200, 255, 200, alpha)
          p.textSize(8)
          p.textAlign(p.CENTER, p.CENTER)
          p.text(valueHex[bi], bx + 9, ry + 11)
        }

        // Label
        p.fill(160, 160, 160, alpha)
        p.textSize(9)
        p.textAlign(p.LEFT, p.TOP)
        p.text(f.name, binX + 82, ry + 24)
      }

      // Schema evolution explanation
      const evoY = 220
      p.fill(255)
      p.textSize(13)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Why Field Tags Enable Schema Evolution', 20, evoY)

      p.fill(180)
      p.textSize(11)
      const explanations = [
        'Because the wire format uses numeric tags (not field names), you can:',
        '',
        '  + ADD a new field with a new tag number. Old code sees an unknown',
        '    tag and skips it (forward compatibility).',
        '',
        '  + REMOVE an optional field. New code sees the tag is missing and',
        '    uses the default value (backward compatibility).',
        '',
        '  - NEVER reuse a tag number. Old data with that tag would be',
        '    misinterpreted. Deleted tags must be reserved forever.',
        '',
        '  - NEVER change a field\'s type in incompatible ways (e.g. string',
        '    to int). Some safe changes: int32 -> int64 (widening).',
      ]
      for (let i = 0; i < explanations.length; i++) {
        const line = explanations[i]
        if (line.startsWith('  +')) p.fill(80, 200, 120)
        else if (line.startsWith('  -')) p.fill(240, 100, 80)
        else p.fill(180)
        p.text(line, 30, evoY + 22 + i * 14)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Protocol Buffers and Thrift</h2>
      <p className="text-gray-300 leading-relaxed">
        Protocol Buffers (Google) and Thrift (Facebook) take a schema-first approach. You define your
        data structure in an IDL (interface definition language) with explicit field tags -- small integers
        that uniquely identify each field. The schema compiler generates code for your target language.
      </p>
      <p className="text-gray-300 leading-relaxed">
        On the wire, field names disappear entirely. Each field is prefixed with its tag number and wire
        type (varint, length-delimited, etc.). This is the key insight that enables schema evolution:
        because readers identify fields by tag number rather than name, you can rename fields freely,
        add new fields (with new tags), and remove optional fields -- all without breaking old readers.
      </p>
      <p className="text-gray-300 leading-relaxed">
        Click each field below to highlight how it maps from the schema definition to the binary encoding.
      </p>
      <P5Sketch
        sketch={sketch}
        height={400}
        controls={
          <ControlPanel title="Highlight Field">
            <div className="flex gap-2">
              {SAMPLE_RECORD.map((f, i) => (
                <button
                  key={i}
                  onClick={() => { setHighlightField(i); stateRef.current.highlightField = i }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    highlightField === i
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {f.name} (tag {f.tag})
                </button>
              ))}
            </div>
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 4 -- Avro: Writer/Reader Schema                            */
/* ================================================================== */
function AvroSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Avro: Writer's Schema vs Reader's Schema</h2>
      <p className="text-gray-300 leading-relaxed">
        Apache Avro takes a fundamentally different approach from Protobuf and Thrift. There are no
        field tags in the binary encoding at all. Instead, values are simply concatenated in the order
        defined by the schema. To decode the data, you need the exact schema that was used to write it
        (the <strong className="text-white">writer's schema</strong>).
      </p>
      <p className="text-gray-300 leading-relaxed">
        When reading, the application provides a <strong className="text-white">reader's schema</strong> --
        the schema it expects. Avro's library resolves differences between the writer's and reader's
        schemas at decode time. Fields present in the writer but not the reader are skipped. Fields in
        the reader but not the writer use the default value. Fields in both must have compatible types.
      </p>
      <p className="text-gray-300 leading-relaxed">
        This design has an elegant benefit for schema evolution. Because the writer's schema is always
        available (embedded in an Avro file header, or resolved from a schema registry), Avro can handle
        any combination of field additions and removals. There is no need for tag numbers -- field matching
        is done by name. You can even reorder fields freely.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-blue-800">
          <h3 className="text-sm font-semibold text-blue-400 mb-2">Writer's Schema (v1)</h3>
          <pre className="text-xs text-gray-300 font-mono">{`{
  "type": "record",
  "name": "Person",
  "fields": [
    {"name": "userName",       "type": "string"},
    {"name": "favoriteNumber", "type": "long"},
    {"name": "interests",      "type": {"type": "array", "items": "string"}}
  ]
}`}</pre>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-green-800">
          <h3 className="text-sm font-semibold text-green-400 mb-2">Reader's Schema (v2)</h3>
          <pre className="text-xs text-gray-300 font-mono">{`{
  "type": "record",
  "name": "Person",
  "fields": [
    {"name": "userName",       "type": "string"},
    {"name": "favoriteNumber", "type": "long"},
    {"name": "email",          "type": ["null","string"],
                               "default": null}
  ]
}`}</pre>
        </div>
      </div>
      <p className="text-gray-300 leading-relaxed text-sm">
        When the reader decodes data written with v1: <strong className="text-white">interests</strong> is
        in the writer but not the reader, so it is skipped. <strong className="text-white">email</strong> is
        in the reader but not the writer, so its default (<code className="text-emerald-400">null</code>) is used.
        This is <strong className="text-white">both forward and backward compatible</strong>, as long as new
        fields have defaults.
      </p>
      <h3 className="text-lg font-semibold text-white mt-6">Avro vs Protobuf: Trade-offs</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-300 border-collapse">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 px-3 text-gray-400">Property</th>
              <th className="text-left py-2 px-3 text-gray-400">Protobuf / Thrift</th>
              <th className="text-left py-2 px-3 text-gray-400">Avro</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-3">Field identification</td>
              <td className="py-2 px-3">Numeric tags in wire format</td>
              <td className="py-2 px-3">Position in schema; matched by name</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-3">Schema needed to decode?</td>
              <td className="py-2 px-3">No (tags are self-describing)</td>
              <td className="py-2 px-3">Yes (writer's schema required)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-3">Encoding compactness</td>
              <td className="py-2 px-3">Very compact (tag overhead per field)</td>
              <td className="py-2 px-3">Most compact (no per-field overhead)</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 px-3">Dynamic schemas</td>
              <td className="py-2 px-3">Harder (need code generation)</td>
              <td className="py-2 px-3">Easy (JSON schema, no codegen needed)</td>
            </tr>
            <tr>
              <td className="py-2 px-3">Schema evolution</td>
              <td className="py-2 px-3">Via tag numbers</td>
              <td className="py-2 px-3">Via writer/reader schema resolution</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 5 -- Schema Evolution Compatibility Matrix (p5)            */
/* ================================================================== */
function CompatibilityMatrixSection() {
  const [scenario, setScenario] = useState(0)
  const stateRef = useRef({ scenario: 0, t: 0 })
  stateRef.current.scenario = scenario

  interface EvolutionScenario {
    label: string
    change: string
    backward: boolean
    forward: boolean
    explanation: string
  }

  const scenarios: EvolutionScenario[] = [
    { label: 'Add optional field', change: '+ email (optional, default null)', backward: true, forward: true, explanation: 'New code uses default when reading old data. Old code ignores unknown field.' },
    { label: 'Add required field', change: '+ email (required, no default)', backward: false, forward: true, explanation: 'New code fails reading old data (missing required field). Old code can still skip it.' },
    { label: 'Remove optional field', change: '- interests (was optional)', backward: true, forward: true, explanation: 'Old code uses default for missing field. New code ignores the old field.' },
    { label: 'Remove required field', change: '- favoriteNumber (was required)', backward: true, forward: false, explanation: 'New code can skip it. Old code fails because a required field is missing.' },
    { label: 'Rename field (Protobuf)', change: 'user_name -> full_name (same tag)', backward: true, forward: true, explanation: 'Tags match, name is irrelevant on the wire. Both directions work.' },
    { label: 'Change type: int32 -> int64', change: 'favoriteNumber: int32 -> int64', backward: true, forward: false, explanation: 'New code can read old int32. Old code may truncate int64 values.' },
  ]

  const sketch = useCallback((p: p5) => {
    let animT = 0

    p.setup = () => {
      p.createCanvas(Math.min(p.windowWidth - 40, 760), 340)
      p.textFont('monospace')
    }

    p.draw = () => {
      animT += 0.02
      const sc = scenarios[stateRef.current.scenario]
      p.background(15, 15, 25)

      const centerX = p.width / 2

      // Old writer / New reader (backward compat)
      const oldWriterX = centerX - 180
      const newReaderX = centerX + 100
      const y1 = 40

      p.fill(255)
      p.noStroke()
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Backward Compatibility: old writer -> new reader', centerX, 14)

      // Old writer box
      p.fill(50, 60, 90)
      p.stroke(100, 140, 220)
      p.strokeWeight(1)
      p.rect(oldWriterX - 60, y1, 120, 50, 6)
      p.fill(100, 180, 255)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Old Writer', oldWriterX, y1 + 16)
      p.fill(160)
      p.textSize(9)
      p.text('Schema v1', oldWriterX, y1 + 35)

      // Arrow
      const arrowPulse = Math.sin(animT * 3) * 0.3 + 0.7
      p.stroke(sc.backward ? p.color(80, 200, 120, 200 * arrowPulse) : p.color(240, 80, 80, 200 * arrowPulse))
      p.strokeWeight(2)
      p.line(oldWriterX + 64, y1 + 25, newReaderX - 64, y1 + 25)
      p.fill(sc.backward ? p.color(80, 200, 120) : p.color(240, 80, 80))
      p.noStroke()
      p.triangle(newReaderX - 64, y1 + 20, newReaderX - 64, y1 + 30, newReaderX - 52, y1 + 25)

      // Data packet
      const packetX = p.lerp(oldWriterX + 64, newReaderX - 64, (Math.sin(animT * 2) + 1) / 2)
      p.fill(200, 200, 100, 180)
      p.rect(packetX - 12, y1 + 15, 24, 20, 4)
      p.fill(50)
      p.textSize(8)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('v1', packetX, y1 + 25)

      // Result badge
      const badgeX = centerX
      const badgeY1 = y1 + 2
      p.fill(sc.backward ? p.color(30, 80, 40) : p.color(80, 30, 30))
      p.rect(badgeX - 15, badgeY1, 30, 18, 3)
      p.fill(255)
      p.textSize(10)
      p.text(sc.backward ? 'OK' : 'FAIL', badgeX, badgeY1 + 9)

      // New reader box
      p.fill(50, 60, 90)
      p.stroke(80, 200, 120)
      p.strokeWeight(1)
      p.rect(newReaderX - 60, y1, 120, 50, 6)
      p.fill(80, 200, 120)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('New Reader', newReaderX, y1 + 16)
      p.fill(160)
      p.textSize(9)
      p.text('Schema v2', newReaderX, y1 + 35)

      // Forward compatibility: new writer -> old reader
      const y2 = 130
      p.fill(255)
      p.textSize(13)
      p.textAlign(p.CENTER, p.TOP)
      p.text('Forward Compatibility: new writer -> old reader', centerX, y2 - 16)

      // New writer
      p.fill(50, 60, 90)
      p.stroke(80, 200, 120)
      p.strokeWeight(1)
      p.rect(oldWriterX - 60, y2, 120, 50, 6)
      p.fill(80, 200, 120)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('New Writer', oldWriterX, y2 + 16)
      p.fill(160)
      p.textSize(9)
      p.text('Schema v2', oldWriterX, y2 + 35)

      // Arrow
      p.stroke(sc.forward ? p.color(80, 200, 120, 200 * arrowPulse) : p.color(240, 80, 80, 200 * arrowPulse))
      p.strokeWeight(2)
      p.line(oldWriterX + 64, y2 + 25, newReaderX - 64, y2 + 25)
      p.fill(sc.forward ? p.color(80, 200, 120) : p.color(240, 80, 80))
      p.noStroke()
      p.triangle(newReaderX - 64, y2 + 20, newReaderX - 64, y2 + 30, newReaderX - 52, y2 + 25)

      // Data packet
      const packetX2 = p.lerp(oldWriterX + 64, newReaderX - 64, (Math.cos(animT * 2) + 1) / 2)
      p.fill(100, 200, 200, 180)
      p.rect(packetX2 - 12, y2 + 15, 24, 20, 4)
      p.fill(50)
      p.textSize(8)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('v2', packetX2, y2 + 25)

      // Result badge
      p.fill(sc.forward ? p.color(30, 80, 40) : p.color(80, 30, 30))
      p.rect(badgeX - 15, y2 + 2, 30, 18, 3)
      p.fill(255)
      p.textSize(10)
      p.text(sc.forward ? 'OK' : 'FAIL', badgeX, y2 + 11)

      // Old reader
      p.fill(50, 60, 90)
      p.stroke(100, 140, 220)
      p.strokeWeight(1)
      p.rect(newReaderX - 60, y2, 120, 50, 6)
      p.fill(100, 180, 255)
      p.noStroke()
      p.textSize(11)
      p.textAlign(p.CENTER, p.CENTER)
      p.text('Old Reader', newReaderX, y2 + 16)
      p.fill(160)
      p.textSize(9)
      p.text('Schema v1', newReaderX, y2 + 35)

      // Change description
      const descY = 210
      p.fill(255, 220, 80)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text(`Change: ${sc.change}`, 30, descY)

      p.fill(200)
      p.textSize(11)
      p.text(sc.explanation, 30, descY + 22)

      // Summary matrix
      const matY = 260
      p.fill(255)
      p.textSize(12)
      p.textAlign(p.LEFT, p.TOP)
      p.text('Compatibility Summary:', 30, matY)

      const labels = ['Backward', 'Forward', 'Full']
      const values = [sc.backward, sc.forward, sc.backward && sc.forward]
      for (let i = 0; i < 3; i++) {
        const mx = 30 + i * 150
        const my = matY + 24
        p.fill(values[i] ? p.color(30, 80, 40) : p.color(80, 30, 30))
        p.rect(mx, my, 120, 30, 4)
        p.fill(255)
        p.textSize(11)
        p.textAlign(p.CENTER, p.CENTER)
        p.text(`${labels[i]}: ${values[i] ? 'YES' : 'NO'}`, mx + 60, my + 15)
      }
    }
  }, [])

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Schema Evolution Rules</h2>
      <p className="text-gray-300 leading-relaxed">
        Not all schema changes are safe. The compatibility of a change depends on whether old and new
        code can co-exist during a rolling upgrade. Select different evolution scenarios below to see
        which are forward-compatible, backward-compatible, or fully compatible.
      </p>
      <p className="text-gray-300 leading-relaxed">
        The golden rule: <strong className="text-white">every new field must be optional or have a default value</strong>.
        Required fields can only be added if you are certain all existing data has been migrated and no
        old writers remain. In practice, making everything optional with sensible defaults is the safest
        approach.
      </p>
      <P5Sketch
        sketch={sketch}
        height={340}
        controls={
          <ControlPanel title="Evolution Scenario">
            <div className="flex flex-wrap gap-2">
              {scenarios.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setScenario(i); stateRef.current.scenario = i }}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    scenario === i
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </ControlPanel>
        }
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 6 -- Dataflow Modes                                        */
/* ================================================================== */
function DataflowModesSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Modes of Dataflow</h2>
      <p className="text-gray-300 leading-relaxed">
        Encoded data flows between processes in three primary ways, each with distinct compatibility
        requirements:
      </p>
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-lg font-semibold text-blue-400 mb-2">1. Through Databases</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            A process writes encoded data to a database; later, another process (or the same process
            after an upgrade) reads it. The database stores data that may have been written by any
            historical version of the application. <strong className="text-white">Backward compatibility
            is essential</strong> -- new code must read old data. Forward compatibility matters too if
            you ever roll back a deployment.
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Danger: if new code reads an old record, adds a new field, and writes it back, the old
            fields must be preserved -- not silently dropped. This is the "read-modify-write" hazard.
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-lg font-semibold text-green-400 mb-2">2. Through Services (REST / RPC)</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            Clients send requests to servers, which return responses. In a microservices architecture,
            services are deployed independently. The server's response schema may evolve independently
            of the client's expectations. <strong className="text-white">Both forward and backward
            compatibility are needed</strong> -- old clients talk to new servers and vice versa.
          </p>
          <p className="text-gray-400 text-sm mt-2">
            REST with JSON is human-friendly but lacks schema enforcement. gRPC (built on Protobuf)
            gives you strong typing, code generation, and efficient binary encoding.
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="text-lg font-semibold text-purple-400 mb-2">3. Through Message Queues</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            A producer encodes a message and publishes it to a queue (Kafka, RabbitMQ, SQS). Consumers
            decode it asynchronously. The producer and consumer are fully decoupled and may run different
            code versions. Messages in the queue may persist for days or weeks.
          </p>
          <p className="text-gray-400 text-sm mt-2">
            This is the hardest case for compatibility. You must assume that messages in the queue were
            written by any version of the producer, and consumers may be running any version. Full
            compatibility (forward + backward) is strongly recommended.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Section 7 -- Python: Binary Encoder/Decoder                        */
/* ================================================================== */
function PythonBinaryEncoderSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Tag-Based Binary Encoder</h2>
      <p className="text-gray-300 leading-relaxed">
        Let us build a simplified Protocol Buffers-style encoder and decoder. Each field is prefixed
        with a tag number and wire type, followed by the value. This demonstrates why field tags enable
        schema evolution -- the decoder can skip unknown tags gracefully.
      </p>
      <PythonCell
        defaultCode={`import struct

# Wire types
VARINT = 0    # int, bool
LENGTH_DELIMITED = 2  # string, bytes, embedded messages

def encode_varint(value):
    """Encode an integer as a variable-length integer (like protobuf)."""
    result = bytearray()
    while value > 0x7f:
        result.append((value & 0x7f) | 0x80)
        value >>= 7
    result.append(value & 0x7f)
    return bytes(result)

def decode_varint(data, pos):
    """Decode a varint starting at pos. Returns (value, new_pos)."""
    result = 0
    shift = 0
    while True:
        byte = data[pos]
        result |= (byte & 0x7f) << shift
        pos += 1
        if not (byte & 0x80):
            break
        shift += 7
    return result, pos

def encode_field(tag, wire_type, value):
    """Encode a single field: tag+type header + value bytes."""
    header = encode_varint((tag << 3) | wire_type)
    if wire_type == VARINT:
        return header + encode_varint(value)
    elif wire_type == LENGTH_DELIMITED:
        encoded = value.encode('utf-8') if isinstance(value, str) else value
        return header + encode_varint(len(encoded)) + encoded

def decode_message(data):
    """Decode all fields from binary data. Returns list of (tag, value)."""
    pos = 0
    fields = []
    while pos < len(data):
        header, pos = decode_varint(data, pos)
        tag = header >> 3
        wire_type = header & 0x07
        if wire_type == VARINT:
            value, pos = decode_varint(data, pos)
            fields.append((tag, value))
        elif wire_type == LENGTH_DELIMITED:
            length, pos = decode_varint(data, pos)
            value = data[pos:pos+length]
            pos += length
            try:
                fields.append((tag, value.decode('utf-8')))
            except:
                fields.append((tag, value))
    return fields

# --- Encode a record ---
record = bytearray()
record += encode_field(1, LENGTH_DELIMITED, "Martin")      # userName
record += encode_field(2, VARINT, 1337)                     # favoriteNumber
record += encode_field(3, LENGTH_DELIMITED, "daydreaming")  # interests[0]

print(f"Encoded {len(record)} bytes:")
print(" ".join(f"{b:02x}" for b in record))
print()

# --- Decode it back ---
decoded = decode_message(bytes(record))
print("Decoded fields:")
for tag, value in decoded:
    print(f"  tag={tag}, value={value!r}")
print()

# --- Forward compatibility demo ---
# Add a NEW field (tag 4) that old code doesn't know about
record_v2 = bytearray(record)
record_v2 += encode_field(4, LENGTH_DELIMITED, "martin@example.com")  # email (new!)

print(f"v2 record with new field: {len(record_v2)} bytes")
decoded_v2 = decode_message(bytes(record_v2))
print("Decoded by 'old' code (ignoring unknown tag 4):")
known_tags = {1: 'userName', 2: 'favoriteNumber', 3: 'interests'}
for tag, value in decoded_v2:
    name = known_tags.get(tag, f'UNKNOWN(tag={tag})')
    print(f"  {name}: {value!r}")`}
        title="Binary Encoder with Field Tags"
      />
    </section>
  )
}

/* ================================================================== */
/*  Section 8 -- Python: Schema Evolution Demo                         */
/* ================================================================== */
function PythonSchemaEvolutionSection() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Python: Schema Evolution in Practice</h2>
      <p className="text-gray-300 leading-relaxed">
        This cell demonstrates the core challenge of schema evolution: encoding data with one version
        of a schema and decoding it with another. We simulate a schema registry and show how a
        well-designed system handles version mismatches gracefully.
      </p>
      <PythonCell
        defaultCode={`# Schema evolution simulation
# Simulating what Avro/Protobuf do under the hood

class SchemaField:
    def __init__(self, name, field_type, tag, default=None, required=False):
        self.name = name
        self.field_type = field_type
        self.tag = tag
        self.default = default
        self.required = required

class Schema:
    def __init__(self, name, version, fields):
        self.name = name
        self.version = version
        self.fields = {f.tag: f for f in fields}
        self.by_name = {f.name: f for f in fields}

def encode(schema, record):
    """Encode a record using the given schema. Returns list of (tag, value) pairs."""
    encoded = []
    for tag, field in sorted(schema.fields.items()):
        if field.name in record:
            encoded.append((tag, record[field.name]))
        elif field.required:
            raise ValueError(f"Missing required field: {field.name}")
        # Optional field not in record -> simply omit from encoded output
    return encoded

def decode(writer_schema, reader_schema, encoded_data):
    """Decode data written with writer_schema using reader_schema."""
    # Build lookup from encoded data
    wire_data = {tag: value for tag, value in encoded_data}

    result = {}
    errors = []

    for tag, reader_field in reader_schema.fields.items():
        if tag in wire_data:
            # Field exists in both schemas — use the wire value
            result[reader_field.name] = wire_data[tag]
        elif reader_field.default is not None:
            # Field missing from wire but has default
            result[reader_field.name] = reader_field.default
        elif reader_field.required:
            errors.append(f"INCOMPATIBLE: required field '{reader_field.name}' (tag {tag}) missing, no default")
        else:
            result[reader_field.name] = None  # Optional, no default

    # Report fields in wire data not in reader schema (skipped)
    skipped = []
    for tag in wire_data:
        if tag not in reader_schema.fields:
            writer_field = writer_schema.fields.get(tag)
            name = writer_field.name if writer_field else f"tag_{tag}"
            skipped.append(f"  Skipped unknown field: '{name}' (tag {tag})")

    return result, errors, skipped

# ---- Define schema versions ----
v1 = Schema("Person", 1, [
    SchemaField("userName",       "string", tag=1, required=True),
    SchemaField("favoriteNumber", "long",   tag=2, default=0),
    SchemaField("interests",      "string", tag=3, default="none"),
])

v2 = Schema("Person", 2, [
    SchemaField("userName",       "string", tag=1, required=True),
    SchemaField("favoriteNumber", "long",   tag=2, default=0),
    SchemaField("email",          "string", tag=4, default="unknown"),
    SchemaField("age",            "int",    tag=5, default=0),
])

# ---- Write with v1, read with v2 (backward compatibility) ----
print("=" * 60)
print("BACKWARD COMPATIBILITY: Write v1, Read v2")
print("=" * 60)
record_v1 = {"userName": "Martin", "favoriteNumber": 1337, "interests": "daydreaming"}
encoded = encode(v1, record_v1)
print(f"\\nEncoded (v1): {encoded}")

decoded, errors, skipped = decode(v1, v2, encoded)
print(f"Decoded (v2): {decoded}")
if skipped:
    print("\\n".join(skipped))
if errors:
    print("ERRORS:", errors)
else:
    print("Result: SUCCESS - old data readable by new code")
    print(f"  'email' filled with default: '{decoded.get('email')}'")
    print(f"  'age' filled with default: {decoded.get('age')}")
    print(f"  'interests' was in v1 but not v2 -> skipped")

# ---- Write with v2, read with v1 (forward compatibility) ----
print()
print("=" * 60)
print("FORWARD COMPATIBILITY: Write v2, Read v1")
print("=" * 60)
record_v2 = {"userName": "Alice", "favoriteNumber": 42, "email": "alice@example.com", "age": 30}
encoded2 = encode(v2, record_v2)
print(f"\\nEncoded (v2): {encoded2}")

decoded2, errors2, skipped2 = decode(v2, v1, encoded2)
print(f"Decoded (v1): {decoded2}")
if skipped2:
    print("\\n".join(skipped2))
if errors2:
    print("ERRORS:", errors2)
else:
    print("Result: SUCCESS - new data readable by old code")
    print(f"  'email' and 'age' gracefully skipped by v1 reader")

# ---- Breaking change: add required field without default ----
print()
print("=" * 60)
print("BREAKING CHANGE: Add required field without default")
print("=" * 60)
v3_bad = Schema("Person", 3, [
    SchemaField("userName",  "string", tag=1, required=True),
    SchemaField("socialSecurity", "string", tag=6, required=True),  # BAD!
])

decoded3, errors3, skipped3 = decode(v1, v3_bad, encoded)
print(f"\\nTrying to read v1 data with v3 schema...")
if errors3:
    for e in errors3:
        print(f"  ERROR: {e}")
    print("  This is why required fields without defaults break backward compatibility!")`}
        title="Schema Evolution: Forward & Backward Compatibility"
      />
    </section>
  )
}

/* ================================================================== */
/*  Main Lesson Component                                              */
/* ================================================================== */
export default function Encoding() {
  return (
    <div className="mx-auto max-w-4xl space-y-16 px-4 py-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold text-white">Encoding & Evolution</h1>
        <p className="text-lg text-gray-400">
          How data is serialized for storage and transmission, and how schemas evolve safely over time
          to enable rolling upgrades without downtime.
        </p>
      </header>

      <WhyEncodingSection />
      <JsonVsBinarySection />
      <ProtobufSection />
      <AvroSection />
      <CompatibilityMatrixSection />
      <DataflowModesSection />
      <PythonBinaryEncoderSection />
      <PythonSchemaEvolutionSection />
    </div>
  )
}
