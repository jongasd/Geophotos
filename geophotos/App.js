/**
 * PhotoLocationScreen.jsx
 *
 * Tela: Câmera + GPS + Google Maps Integradro & Design Otimizado
 *
 * Dependências (instalar no projeto Expo):
 *   npx expo install expo-camera expo-location react-native-maps

 *       }
 *     }
 *   }
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
  StatusBar,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

const { width } = Dimensions.get("window");

export default function PhotoLocationScreen() {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [, setLocationPermissionStatus] = useState(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  const cameraRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function ensureCameraPermission() {
      if (!cameraPermission) return;
      if (!cameraPermission.granted && cameraPermission.canAskAgain) {
        const result = await requestCameraPermission();
        if (isActive && !result.granted) {
          setPermissionError(
            "Permissão de câmera negada. Não é possível tirar fotos.",
          );
        }
      } else if (!cameraPermission.granted && !cameraPermission.canAskAgain) {
        if (isActive) {
          setPermissionError(
            "Permissão de câmera negada permanentemente. Habilite nas configurações.",
          );
        }
      }
    }

    ensureCameraPermission();

    return () => {
      isActive = false;
    };
  }, [cameraPermission?.granted]);

  const handleOpenCamera = useCallback(async () => {
    setPermissionError(null);

    if (!cameraPermission?.granted) {
      const camResult = await requestCameraPermission();
      if (!camResult.granted) {
        setPermissionError("Sem permissão de câmera para continuar.");
        return;
      }
    }

    const locResult = await Location.requestForegroundPermissionsAsync();
    setLocationPermissionStatus(locResult.status);
    if (locResult.status !== Location.PermissionStatus.GRANTED) {
      setPermissionError(
        "Permissão de GPS negada. As fotos serão tiradas sem coordenadas.",
      );
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
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });

      let latitude = null;
      let longitude = null;
      let accuracy = null;

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === Location.PermissionStatus.GRANTED) {
        try {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          accuracy = position.coords.accuracy;
        } catch (locError) {
          console.warn("Falha ao obter localização:", locError);
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

  function renderPhotoItem({ item }) {
    const hasCoords = item.latitude != null && item.longitude != null;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => setSelectedPhoto(item)}
      >
        <Image source={{ uri: item.uri }} style={styles.cardThumbnail} />
        <View style={styles.cardContent}>
          <View style={styles.badgeContainer}>
            <Text
              style={[
                styles.badgeText,
                hasCoords ? styles.badgeGpsActive : styles.badgeGpsInactive,
              ]}
            >
              {hasCoords ? "📍 GPS Conectado" : "⚠️ Sem GPS"}
            </Text>
          </View>
          <Text style={styles.cardCoords}>
            {hasCoords
              ? `${item.latitude.toFixed(4)}°, ${item.longitude.toFixed(4)}°`
              : "Localização indisponível"}
          </Text>
          <Text style={styles.cardDate}>
            {new Date(item.timestamp).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <Text style={styles.cardChevron}>›</Text>
      </TouchableOpacity>
    );
  }

  if (isCameraOpen) {
    if (!cameraPermission?.granted) {
      return (
        <SafeAreaView style={styles.centeredContainer}>
          <Text style={styles.errorText}>
            Permissão de câmera não concedida.
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCloseCamera}
          >
            <Text style={styles.secondaryButtonText}>Voltar</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <StatusBar hidden />
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          <SafeAreaView style={styles.cameraOverlay}>
            <TouchableOpacity
              style={styles.closeCameraButton}
              onPress={handleCloseCamera}
            >
              <Text style={styles.closeCameraText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.captureOuterRing}
                onPress={handleCapture}
                disabled={isCapturing}
                activeOpacity={0.7}
              >
                {isCapturing ? (
                  <ActivityIndicator color="#4F46E5" size="large" />
                ) : (
                  <View style={styles.captureInnerCircle} />
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Galeria com GPS</Text>
          <Text style={styles.headerSubtitle}>
            {photos.length}{" "}
            {photos.length === 1 ? "foto registrada" : "fotos registradas"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleOpenCamera}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>+ Nova Foto</Text>
        </TouchableOpacity>
      </View>

      {permissionError && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>⚠️ {permissionError}</Text>
        </View>
      )}

      {/* Body */}
      {photos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Text style={{ fontSize: 36 }}>📷</Text>
          </View>
          <Text style={styles.emptyTitle}>Nenhuma foto capturada</Text>
          <Text style={styles.emptySubtitle}>
            Toque no botão "+ Nova Foto" para capturar imagens e vinculá-las à
            sua localização no Google Maps.
          </Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhotoItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Modal Detalhado com Google Maps */}
      <Modal
        visible={!!selectedPhoto}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.modalContainer}>
          {selectedPhoto && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Detalhes do Registro</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setSelectedPhoto(null)}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {/* Visualização de Imagem */}
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: selectedPhoto.uri }}
                    style={styles.modalImage}
                    resizeMode="cover"
                  />
                </View>

                {/* Seção do Mapa / Coordenadas */}
                <View style={styles.mapSection}>
                  {selectedPhoto.latitude && selectedPhoto.longitude ? (
                    <MapView
                      provider={PROVIDER_GOOGLE}
                      style={styles.map}
                      initialRegion={{
                        latitude: selectedPhoto.latitude,
                        longitude: selectedPhoto.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      }}
                    >
                      <Marker
                        coordinate={{
                          latitude: selectedPhoto.latitude,
                          longitude: selectedPhoto.longitude,
                        }}
                        title="Foto tirada aqui"
                        description={new Date(
                          selectedPhoto.timestamp,
                        ).toLocaleString("pt-BR")}
                      />
                    </MapView>
                  ) : (
                    <View style={styles.noMapBox}>
                      <Text style={styles.noMapText}>
                        📍 Localização indisponível para esta captura.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Card de Informações Metabólicas */}
                <View style={styles.metaCard}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Coordenadas:</Text>
                    <Text style={styles.metaValue}>
                      {selectedPhoto.latitude != null
                        ? `${selectedPhoto.latitude.toFixed(6)}, ${selectedPhoto.longitude.toFixed(6)}`
                        : "N/A"}
                    </Text>
                  </View>
                  {selectedPhoto.accuracy != null && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Precisão GPS:</Text>
                      <Text style={styles.metaValue}>
                        ±{Math.round(selectedPhoto.accuracy)} metros
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Data e Hora:</Text>
                    <Text style={styles.metaValue}>
                      {new Date(selectedPhoto.timestamp).toLocaleString(
                        "pt-BR",
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  primaryButton: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },

  /* Warnings & Messages */
  warningBox: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
  },
  warningText: {
    color: "#92400E",
    fontSize: 13,
    fontWeight: "500",
  },
  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 16,
  },

  /* Empty State */
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },

  /* List & Cards */
  listContent: {
    padding: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  cardContent: {
    flex: 1,
    marginLeft: 14,
  },
  badgeContainer: {
    flexDirection: "row",
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  badgeGpsActive: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
  },
  badgeGpsInactive: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
  },
  cardCoords: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  cardDate: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  cardChevron: {
    fontSize: 22,
    color: "#CBD5E1",
    paddingHorizontal: 8,
  },

  /* Camera UI */
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justify: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeCameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justify: "center",
    marginTop: 10,
  },
  closeCameraText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  cameraControls: {
    alignItems: "center",
    marginBottom: 20,
  },
  captureOuterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justify: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  captureInnerCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },

  /* Modal & Google Maps */
  modalContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  modalHeader: {
    flexDirection: "row",
    justify: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justify: "center",
  },
  modalCloseText: {
    color: "#64748B",
    fontSize: 16,
    fontWeight: "600",
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  imagePreviewContainer: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#E2E8F0",
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  mapSection: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    backgroundColor: "#E2E8F0",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  noMapBox: {
    flex: 1,
    alignItems: "center",
    justify: "center",
    backgroundColor: "#F1F5F9",
    padding: 16,
  },
  noMapText: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
  },
  metaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metaRow: {
    flexDirection: "row",
    justify: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  metaLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  metaValue: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: "#1E293B",
    fontWeight: "600",
  },
});
