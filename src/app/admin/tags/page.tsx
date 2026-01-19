'use client'

import { useCallback, useMemo, useState } from 'react'
import { NFCScanner } from '@/components/nfc/nfc-scanner'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { findEntityByNFCTag, removeEntityNFCTag } from '@/utils/nfc'
import type { NFCReadResult } from '@/types'

type TagAssociation = {
  tagId: string
  entityType: 'garment' | 'box'
  entityId: string
  entityName: string
}

export default function AdminTagsPage() {
  const [mode, setMode] = useState<'read' | 'write' | null>(null)
  const [writeTagId, setWriteTagId] = useState('')
  const [scannedTagId, setScannedTagId] = useState('')
  const [association, setAssociation] = useState<TagAssociation | null>(null)
  const [ndefRecords, setNdefRecords] = useState<NFCReadResult | null>(null)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const generateWriteTagId = useCallback(() => {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID().replace(/-/g, '').toUpperCase()
      }
    } catch {}

    const timestamp = Date.now().toString(16)
    const random = Math.floor(Math.random() * 0xFFFFFFFFFFFF).toString(16)
    return `${timestamp}${random}`.toUpperCase()
  }, [])

  const handleScan = useCallback(async (tagId: string) => {
    setError('')
    setInfo('')
    setScannedTagId(tagId)
    setAssociation(null)

    const result = await findEntityByNFCTag(tagId)
    if (result) {
      setAssociation({
        tagId: result.tagId,
        entityType: result.entityType,
        entityId: result.entityId,
        entityName: result.entityName
      })
      setInfo(`Tag asociado a ${result.entityType === 'garment' ? 'prenda' : 'caja'}: "${result.entityName}".`)
    } else {
      setInfo('Tag libre. Puedes escribir un nuevo ID si lo deseas.')
    }
  }, [])

  const handleReadDetails = useCallback((result: NFCReadResult) => {
    setNdefRecords(result)
  }, [])

  const handleWrite = useCallback((tagId: string) => {
    setError('')
    setInfo('Tag sobrescrito con un único registro UTF‑8. Ahora está listo para asociarse.')
    setScannedTagId(tagId)
    setAssociation(null)
  }, [])

  const handleError = useCallback((message: string) => {
    setError(`Error NFC: ${message}`)
  }, [])

  const handleStartWrite = useCallback(() => {
    setError('')
    setInfo('')
    setAssociation(null)
    setScannedTagId('')
    setNdefRecords(null)
    setWriteTagId(generateWriteTagId())
    setMode('write')
  }, [generateWriteTagId])

  const handleStartRead = useCallback(() => {
    setError('')
    setInfo('')
    setNdefRecords(null)
    setMode('read')
  }, [])

  const handleClearAssociation = useCallback(async () => {
    if (!association) return
    const confirmed = confirm(`¿Deseas liberar el tag de la ${association.entityType === 'garment' ? 'prenda' : 'caja'} "${association.entityName}"?`)
    if (!confirmed) return

    setBusy(true)
    setError('')
    try {
      const success = await removeEntityNFCTag(association.entityType, association.entityId)
      if (!success) {
        setError('No se pudo liberar el tag. Revisa los permisos o vuelve a intentar.')
        return
      }
      setAssociation(null)
      setInfo('Tag liberado correctamente. Ahora puedes escribir un nuevo ID.')
    } finally {
      setBusy(false)
    }
  }, [association])

  const scannerTitle = useMemo(() => {
    if (mode === 'write') return 'Escribir nuevo ID en tag'
    if (mode === 'read') return 'Escanear tag existente'
    return 'Gestionar Tag NFC'
  }, [mode])

  const scannerDescription = useMemo(() => {
    if (mode === 'write') return 'Acércate un tag NFC para sobrescribirlo con un único ID.'
    if (mode === 'read') return 'Escanea un tag para revisar asociación o liberarlo.'
    return 'Selecciona una acción para administrar tags NFC.'
  }, [mode])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestionar Tag NFC</CardTitle>
          <CardDescription>
            Herramientas de administración para revisar, liberar y reescribir tags NFC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleStartRead} variant={mode === 'read' ? 'default' : 'outline'}>
              Escanear tag existente
            </Button>
            <Button onClick={handleStartWrite} variant={mode === 'write' ? 'default' : 'outline'}>
              Escribir nuevo ID
            </Button>
            <Button onClick={() => setMode(null)} variant="ghost">
              Limpiar
            </Button>
          </div>

          {mode && (
            <NFCScanner
              mode={mode}
              onSuccess={mode === 'read' ? handleScan : handleWrite}
              onError={handleError}
              onReadDetails={mode === 'read' ? handleReadDetails : undefined}
              expectedTagId={mode === 'write' ? writeTagId : undefined}
              title={scannerTitle}
              description={scannerDescription}
              skipExistenceCheck={true} // Siempre permitir leer tags asociados (para gestionarlos)
            />
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {info && (
            <Alert>
              <AlertDescription>{info}</AlertDescription>
            </Alert>
          )}

          {scannedTagId && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Tag leído:</p>
              <Badge variant="secondary">{scannedTagId}</Badge>
            </div>
          )}

          {association && (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="font-medium">Asociación detectada</p>
              <div className="text-sm text-muted-foreground">
                {association.entityType === 'garment' ? 'Prenda' : 'Caja'}: {association.entityName}
              </div>
              <Button onClick={handleClearAssociation} disabled={busy}>
                {busy ? 'Liberando...' : 'Liberar tag'}
              </Button>
            </div>
          )}

          {ndefRecords?.ndefTextRecords && ndefRecords.ndefTextRecords.length > 0 && (
            <div className="space-y-2 rounded-lg border p-4">
              <p className="font-medium">Registros NDEF detectados</p>
              {ndefRecords.ndefTextRecords.map((record, index) => {
                const isUtf8Selected = 
                  (ndefRecords.selectedSource === 'utf8-1' && index === 0) ||
                  (ndefRecords.selectedSource === 'utf8-2' && index === 1)
                const isHexSelected = ndefRecords.selectedSource === 'hex' && index === 0
                
                return (
                  <div key={`ndef-${index}`} className="space-y-2">
                    <div 
                      className={`p-2 rounded text-sm ${
                        isUtf8Selected 
                          ? 'bg-green-100 dark:bg-green-900 border-2 border-green-500' 
                          : 'bg-muted'
                      }`}
                    >
                      <span className="font-medium">Registro {index + 1} (UTF‑8): </span>
                      <Badge variant={isUtf8Selected ? 'default' : 'secondary'}>
                        {record || '(vacío)'}
                      </Badge>
                      {isUtf8Selected && (
                        <span className="ml-2 text-green-600 dark:text-green-400 font-bold">
                          ✓ Usado como ID
                        </span>
                      )}
                    </div>
                    {ndefRecords.ndefHexRecords?.[index] && (
                      <div 
                        className={`p-2 rounded text-xs font-mono overflow-hidden ${
                          isHexSelected 
                            ? 'bg-green-100 dark:bg-green-900 border-2 border-green-500' 
                            : 'bg-muted'
                        }`}
                      >
                        <span className="text-muted-foreground">HEX {index + 1}: </span>
                        <span className="break-all block mt-1">
                          {ndefRecords.ndefHexRecords[index]}
                        </span>
                        {isHexSelected && (
                          <span className="text-green-600 dark:text-green-400 font-bold block mt-2">
                            ✓ Usado como ID
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
