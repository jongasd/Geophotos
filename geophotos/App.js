/**
 * PhotoLocationScreen.jsx
 *
 * Tela: Câmera + GPS
 * - Tira fotos e salva, junto de cada uma, a localização (lat/lng) do momento da captura
 * - Lista as fotos tiradas, cada uma com sua localização exibida
 * - Ao tocar em uma foto, mostra ela ampliada com as coordenadas
 *
 * Requisitos atendidos:
 * - Solicita permissão de câmera e de localização antes de usar (nunca assume concedida)
 * - Trata o caso de permissão negada (mensagem na tela, sem travar o app)
 * - Remove listeners/subscriptions no cleanup do useEffect
 * - Funciona como tela única (pode ser plugada em um Stack/Tab existente)
 *
 * Dependências (instalar no projeto Expo):
 *   npx expo install expo-camera expo-location
 *
 * Uso em um hub de navegação (ex: Stack.Navigator já existente):
 *   <Stack.Screen name="PhotoLocation" component={PhotoLocationScreen} />
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";

export default function PhotoLocationScreen() {
  // --- Permissões de câmera (hook do expo-camera já gerencia estado de permissão) ---
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // --- Permissão de localização é tratada manualmente (expo-location não tem hook pronto) ---
  const [locationPermissionStatus, setLocationPermissionStatus] =
    useState(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  const cameraRef = useRef(null);

  // Guarda se o componente ainda está montado, para não atualizar state depois do unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      // Cleanup ao sair da tela
      isMountedRef.current = false;
    };
  }, []);

  // --- Solicita permissão de câmera assim que a tela monta (nunca assume concedida) ---
  useEffect(() => {
    let isActive = true;

    async function ensureCameraPermission() {
      if (!cameraPermission) return; // ainda carregando o hook
      if (!cameraPermission.granted && cameraPermission.canAskAgain) {
        const result = await requestCameraPermission();
        if (isActive && !result.granted) {
          setPermissionError(
            "Permissão de câmera negada. Não é possível tirar fotos sem ela.",
          );
        }
      } else if (!cameraPermission.granted && !cameraPermission.canAskAgain) {
        if (isActive) {
          setPermissionError(
            "Permissão de câmera negada permanentemente. Habilite nas configurações do app.",
          );
        }
      }
    }

    ensureCameraPermission();

    return () => {
      isActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPermission?.granted]);

  // Handler para abrir a câmera: aqui é onde de fato pedimos localização também,
  // já que só precisamos dela no momento da captura.
  const handleOpenCamera = useCallback(async () => {
    setPermissionError(null);

    // 1) Garante permissão de câmera
    if (!cameraPermission?.granted) {
      const camResult = await requestCameraPermission();
      if (!camResult.granted) {
        setPermissionError(
          "Sem permissão de câmera, não é possível continuar.",
        );
        return;
      }
    }

    // 2) Garante permissão de localização
    const locResult = await Location.requestForegroundPermissionsAsync();
    setLocationPermissionStatus(locResult.status);
    if (locResult.status !== Location.PermissionStatus.GRANTED) {
      setPermissionError(
        "Permissão de localização negada. As fotos serão tiradas sem coordenadas.",
      );
      // Não travamos o app: o usuário ainda pode tirar fotos, só sem GPS.
    }

    setIsCameraOpen(true);
  }, [cameraPermission, requestCameraPermission]);

  const handleCloseCamera = useCallback(() => {
    setIsCameraOpen(false);
  }, []);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });

      let latitude = null;
      let longitude = null;
      let accuracy = null;

      // Só tenta ler localização se a permissão foi concedida
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === Location.PermissionStatus.GRANTED) {
        try {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          accuracy = position.coords.accuracy;
        } catch (locError) {
          console.warn("Falha ao obter localização:", locError);
          // Continua sem travar: foto é salva mesmo sem coordenadas
        }
      }

      const entry = {
        id: `${Date.now()}`,
        uri: photo?.uri ?? "",
        latitude,
        longitude,
        accuracy,
        timestamp: Date.now(),
      };

      if (isMountedRef.current) {
        setPhotos((prev) => [entry, ...prev]);
        setIsCameraOpen(false);
      }
    } catch (err) {
      console.error("Erro ao tirar foto:", err);
      Alert.alert("Erro", "Não foi possível tirar a foto. Tente novamente.");
    } finally {
      if (isMountedRef.current) {
        setIsCapturing(false);
      }
    }
  }, [isCapturing]);

  function formatCoords(entry) {
    if (entry.latitude == null || entry.longitude == null) {
      return "Localização indisponível";
    }
    return `Lat: ${entry.latitude.toFixed(5)}  Lng: ${entry.longitude.toFixed(5)}`;
  }

  function renderPhotoItem({ item }) {
    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => setSelectedPhoto(item)}
      >
        <Image source={{ uri: item.uri }} style={styles.thumbnail} />
        <View style={styles.listItemText}>
          <Text style={styles.coordsText}>{formatCoords(item)}</Text>
          <Text style={styles.dateText}>
            {new Date(item.timestamp).toLocaleString("pt-BR")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // --- Tela de câmera (modal fullscreen) ---
  if (isCameraOpen) {
    if (!cameraPermission?.granted) {
      return (
        <SafeAreaView style={styles.centered}>
          <Text style={styles.errorText}>
            Permissão de câmera não concedida.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleCloseCamera}>
            <Text style={styles.buttonText}>Voltar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCloseCamera}
          >
            <Text style={styles.buttonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
          <View style={{ width: 80 }} />
        </View>
      </View>
    );
  }

  // --- Tela principal: lista de fotos ---
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Fotos com Localização</Text>

      {permissionError ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{permissionError}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.button} onPress={handleOpenCamera}>
        <Text style={styles.buttonText}>Tirar nova foto</Text>
      </TouchableOpacity>

      {photos.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Nenhuma foto tirada ainda.</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhotoItem}
          contentContainerStyle={styles.list}
        />
      )}

      {/* Modal com a foto ampliada + coordenadas */}
      <Modal
        visible={!!selectedPhoto}
        animationType="slide"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <SafeAreaView style={styles.detailContainer}>
          {selectedPhoto && (
            <>
              <Image
                source={{ uri: selectedPhoto.uri }}
                style={styles.detailImage}
              />
              <View style={styles.detailInfo}>
                <Text style={styles.coordsTextLarge}>
                  {formatCoords(selectedPhoto)}
                </Text>
                {selectedPhoto.accuracy != null && (
                  <Text style={styles.dateText}>
                    Precisão: ±{Math.round(selectedPhoto.accuracy)} m
                  </Text>
                )}
                <Text style={styles.dateText}>
                  {new Date(selectedPhoto.timestamp).toLocaleString("pt-BR")}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.button}
                onPress={() => setSelectedPhoto(null)}
              >
                <Text style={styles.buttonText}>Fechar</Text>
              </TouchableOpacity>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  emptyText: { color: "#666", fontSize: 15 },
  warningBox: {
    backgroundColor: "#FFF3CD",
    borderColor: "#FFECB5",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  warningText: { color: "#664D03", fontSize: 13 },
  button: {
    backgroundColor: "#2563EB",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  list: { paddingBottom: 24 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    overflow: "hidden",
  },
  thumbnail: { width: 72, height: 72 },
  listItemText: { flex: 1, paddingHorizontal: 12 },
  coordsText: { fontSize: 14, fontWeight: "600" },
  coordsTextLarge: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  dateText: { fontSize: 12, color: "#666", marginTop: 2 },
  errorText: {
    fontSize: 15,
    color: "#B91C1C",
    textAlign: "center",
    marginBottom: 16,
  },

  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  cameraControls: {
    position: "absolute",
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  cancelButton: {
    width: 80,
    paddingVertical: 10,
    alignItems: "center",
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },

  detailContainer: { flex: 1, backgroundColor: "#000", padding: 16 },
  detailImage: { flex: 1, borderRadius: 12, marginBottom: 16 },
  detailInfo: { marginBottom: 16 },
});
