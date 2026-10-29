import React, { useState, useEffect } from 'react';
import { MenuItem, MenuCategory, ModifierGroup, ModifierOption } from '../../../types';
import { Modal, Button, formatCurrency } from '../../../components/shared';
import {
  Upload,
  Image as ImageIcon,
  Plus,
  Trash2,
  Layers,
  Check,
  AlertCircle,
  X,
  HelpCircle,
} from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: MenuItem | null;
  categories: MenuCategory[];
  onSave: (productData: Omit<MenuItem, 'id'> & { id?: string }) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  categories,
  onSave,
}) => {
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState<string>('');
  const [promotionalPrice, setPromotionalPrice] = useState<string>('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [preparationTimeMinutes, setPreparationTimeMinutes] = useState('15');
  const [highlightBadge, setHighlightBadge] = useState('');
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);

  // Validation & tab state
  const [activeTab, setActiveTab] = useState<'info' | 'modifiers'>('info');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || '');
      setDescription(productToEdit.description || '');
      setCategoryId(productToEdit.categoryId || (categories[0]?.id || ''));
      setPrice(productToEdit.price !== undefined ? String(productToEdit.price) : '');
      setPromotionalPrice(
        productToEdit.promotionalPrice !== undefined && productToEdit.promotionalPrice > 0
          ? String(productToEdit.promotionalPrice)
          : ''
      );
      setIsAvailable(productToEdit.isAvailable !== undefined ? productToEdit.isAvailable : true);
      setImageUrl(productToEdit.imageUrl || '');
      setPreparationTimeMinutes(
        productToEdit.preparationTimeMinutes ? String(productToEdit.preparationTimeMinutes) : '15'
      );
      setHighlightBadge(productToEdit.highlightBadge || '');
      setModifierGroups(
        productToEdit.modifierGroups
          ? JSON.parse(JSON.stringify(productToEdit.modifierGroups))
          : []
      );
    } else {
      // Defaults for new product
      setName('');
      setDescription('');
      setCategoryId(categories[0]?.id || '');
      setPrice('');
      setPromotionalPrice('');
      setIsAvailable(true);
      setImageUrl('');
      setPreparationTimeMinutes('15');
      setHighlightBadge('');
      setModifierGroups([]);
    }
    setErrors({});
    setActiveTab('info');
  }, [productToEdit, isOpen, categories]);

  // Handle local image file upload
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, image: 'A imagem deve ter até 4MB' }));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImageUrl(reader.result);
          setErrors(prev => {
            const next = { ...prev };
            delete next.image;
            return next;
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Add new modifier group
  const handleAddModifierGroup = () => {
    const newGroup: ModifierGroup = {
      id: `group_${Date.now()}`,
      name: 'Novo Grupo de Adicionais',
      isRequired: false,
      minQuantity: 0,
      maxQuantity: 1,
      options: [
        { id: `opt_${Date.now()}_1`, name: 'Opção 1', price: 0 },
        { id: `opt_${Date.now()}_2`, name: 'Opção 2', price: 0 },
      ],
    };
    setModifierGroups(prev => [...prev, newGroup]);
    setActiveTab('modifiers');
  };

  // Remove modifier group
  const handleRemoveModifierGroup = (groupId: string) => {
    setModifierGroups(prev => prev.filter(g => g.id !== groupId));
  };

  // Update modifier group attributes
  const handleUpdateGroup = (
    groupId: string,
    updates: Partial<ModifierGroup>
  ) => {
    setModifierGroups(prev =>
      prev.map(g => (g.id === groupId ? { ...g, ...updates } : g))
    );
  };

  // Add option to group
  const handleAddOptionToGroup = (groupId: string) => {
    const newOption: ModifierOption = {
      id: `opt_${Date.now()}`,
      name: 'Nova Opção',
      price: 0,
    };
    setModifierGroups(prev =>
      prev.map(g => {
        if (g.id === groupId) {
          return { ...g, options: [...g.options, newOption] };
        }
        return g;
      })
    );
  };

  // Update option in group
  const handleUpdateOption = (
    groupId: string,
    optionId: string,
    updates: Partial<ModifierOption>
  ) => {
    setModifierGroups(prev =>
      prev.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            options: g.options.map(opt =>
              opt.id === optionId ? { ...opt, ...updates } : opt
            ),
          };
        }
        return g;
      })
    );
  };

  // Remove option from group
  const handleRemoveOption = (groupId: string, optionId: string) => {
    setModifierGroups(prev =>
      prev.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            options: g.options.filter(opt => opt.id !== optionId),
          };
        }
        return g;
      })
    );
  };

  // Save validation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!name.trim()) {
      newErrors.name = 'O nome do produto é obrigatório.';
    }

    const parsedPrice = parseFloat(price.replace(',', '.'));
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      newErrors.price = 'Informe um preço válido maior que zero.';
    }

    let parsedPromo: number | undefined = undefined;
    if (promotionalPrice.trim()) {
      parsedPromo = parseFloat(promotionalPrice.replace(',', '.'));
      if (isNaN(parsedPromo) || parsedPromo <= 0) {
        newErrors.promotionalPrice = 'Preço promocional deve ser válido.';
      } else if (parsedPromo >= parsedPrice) {
        newErrors.promotionalPrice = 'Preço promocional deve ser menor que o preço original.';
      }
    }

    if (!categoryId) {
      newErrors.category = 'Selecione uma categoria para o produto.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setActiveTab('info');
      return;
    }

    // Submit valid payload
    onSave({
      ...(productToEdit?.id ? { id: productToEdit.id } : {}),
      name: name.trim(),
      description: description.trim(),
      categoryId,
      price: parsedPrice,
      promotionalPrice: parsedPromo,
      isAvailable,
      imageUrl: imageUrl.trim() || undefined,
      preparationTimeMinutes: parseInt(preparationTimeMinutes, 10) || 15,
      highlightBadge: highlightBadge.trim() || undefined,
      modifierGroups,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={productToEdit ? 'Editar Produto' : 'Novo Produto'}
      subtitle={
        productToEdit
          ? `Editando ${productToEdit.name}`
          : 'Cadastre um novo item no cardápio'
      }
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancelar
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            className="flex-1 sm:flex-initial sm:px-8"
          >
            {productToEdit ? 'Salvar Alterações' : 'Criar Produto'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-zinc-200">
        {/* Navigation Tabs inside modal: Info vs Modifiers */}
        <div className="flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'info'
                ? 'bg-[#FF5500] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Dados Principais</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('modifiers')}
            className={`flex-1 py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'modifiers'
                ? 'bg-[#FF5500] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Adicionais & Extras ({modifierGroups.length})</span>
          </button>
        </div>

        {/* TAB 1: DADOS PRINCIPAIS */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* Image Upload Row */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                Foto do Produto
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-4 p-3.5 rounded-2xl bg-[#0E1015] border border-zinc-850">
                {/* Image Preview Box */}
                <div className="relative w-24 h-24 rounded-xl bg-zinc-900 border border-zinc-800 shrink-0 overflow-hidden flex items-center justify-center">
                  {imageUrl ? (
                    <>
                      <img
                        src={imageUrl}
                        alt="Prévia do produto"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black text-white rounded-full transition-colors"
                        title="Remover imagem"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-600 text-center p-2">
                      <ImageIcon className="w-6 h-6 text-zinc-500 mb-1" />
                      <span className="text-[10px]">Sem foto</span>
                    </div>
                  )}
                </div>

                {/* Upload action & URL input */}
                <div className="flex-1 space-y-2 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl border border-zinc-700 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-orange-400" />
                      <span>Selecionar foto do dispositivo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>

                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="text-xs text-rose-400 hover:text-rose-300"
                      >
                        Limpar foto
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="Ou cole a URL da imagem aqui..."
                    className="w-full h-9 px-3 bg-[#13161D] border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs rounded-xl focus:outline-none focus:border-orange-500/50"
                  />
                  {errors.image && (
                    <p className="text-[11px] text-rose-400">{errors.image}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Name & Badge Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Prato da casa"
                  className={`w-full h-11 px-3.5 bg-[#0E1015] border rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 ${
                    errors.name ? 'border-rose-500' : 'border-zinc-800 focus:border-orange-500'
                  }`}
                />
                {errors.name && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Selo de Destaque
                </label>
                <input
                  type="text"
                  value={highlightBadge}
                  onChange={e => setHighlightBadge(e.target.value)}
                  placeholder="Ex: Mais Vendido"
                  className="w-full h-11 px-3.5 bg-[#0E1015] border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Descrição Curta
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Descreva os ingredientes saborosos, tamanho e detalhes do preparo..."
                className="w-full p-3 bg-[#0E1015] border border-zinc-800 rounded-xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 resize-none"
              />
            </div>

            {/* Category & Status Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Categoria *
                </label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className={`w-full h-11 px-3.5 bg-[#0E1015] border rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500/50 ${
                    errors.category ? 'border-rose-500' : 'border-zinc-800 focus:border-orange-500'
                  }`}
                >
                  <option value="" disabled>Selecione uma categoria</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id} className="bg-zinc-900 text-white">
                      {cat.name} {!cat.isActive ? '(Pausada)' : ''}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.category}</p>
                )}
              </div>

              {/* Status Toggle */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Disponibilidade no Cardápio
                </label>
                <div className="flex items-center justify-between h-11 px-3.5 bg-[#0E1015] border border-zinc-800 rounded-xl">
                  <span className="text-xs font-medium text-zinc-300">
                    {isAvailable ? 'Item Ativo (Visível para compra)' : 'Item Pausado (Esgotado)'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAvailable(!isAvailable)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isAvailable ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isAvailable ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Price, Promotional Price & Prep Time */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Preço de Venda (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs text-zinc-400 font-mono">
                    R$
                  </span>
                  <input
                    type="text"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="36,90"
                    className={`w-full h-11 pl-10 pr-3 bg-[#0E1015] border rounded-xl text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 ${
                      errors.price ? 'border-rose-500' : 'border-zinc-800 focus:border-orange-500'
                    }`}
                  />
                </div>
                {errors.price && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.price}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Preço Promocional (Opcional)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs text-zinc-400 font-mono">
                    R$
                  </span>
                  <input
                    type="text"
                    value={promotionalPrice}
                    onChange={e => setPromotionalPrice(e.target.value)}
                    placeholder="32,90"
                    className={`w-full h-11 pl-10 pr-3 bg-[#0E1015] border rounded-xl text-sm font-mono text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 ${
                      errors.promotionalPrice
                        ? 'border-rose-500'
                        : 'border-zinc-800 focus:border-orange-500'
                    }`}
                  />
                </div>
                {errors.promotionalPrice && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.promotionalPrice}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Tempo de Preparo (min)
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={preparationTimeMinutes}
                  onChange={e => setPreparationTimeMinutes(e.target.value)}
                  className="w-full h-11 px-3.5 bg-[#0E1015] border border-zinc-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ADICIONAIS E PERSONALIZAÇÕES */}
        {activeTab === 'modifiers' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-[#0E1015] border border-zinc-850">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-orange-400" />
                  <span>Grupos de Adicionais & Complementos</span>
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Ex: Ponto da carne (obrigatório), Adicionais extras, Bebidas do combo
                </p>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleAddModifierGroup}
              >
                + Criar Grupo
              </Button>
            </div>

            {modifierGroups.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#0E1015] border border-dashed border-zinc-800">
                <Layers className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                <h5 className="text-sm font-semibold text-zinc-300">
                  Nenhum grupo de adicionais configurado
                </h5>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-4">
                  Permita que seus clientes personalizem o item escolhendo o ponto, adicionando bacon, queijo extra ou molhos.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={handleAddModifierGroup}
                >
                  Adicionar Primeiro Grupo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {modifierGroups.map((group, groupIndex) => (
                  <div
                    key={group.id}
                    className="p-4 rounded-2xl bg-[#10131A] border border-zinc-800 space-y-3"
                  >
                    {/* Group Header: Name, Required toggle, Delete Group */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-zinc-850">
                      <div className="flex-1 min-w-[200px]">
                        <input
                          type="text"
                          value={group.name}
                          onChange={e =>
                            handleUpdateGroup(group.id, { name: e.target.value })
                          }
                          placeholder="Nome do grupo (ex: Escolha o ponto da carne)"
                          className="w-full h-9 px-2.5 bg-[#0A0C0F] border border-zinc-700/80 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Obrigatório toggle */}
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-300">
                          <input
                            type="checkbox"
                            checked={group.isRequired}
                            onChange={e => {
                              const checked = e.target.checked;
                              handleUpdateGroup(group.id, {
                                isRequired: checked,
                                minQuantity: checked ? 1 : 0,
                              });
                            }}
                            className="rounded border-zinc-700 text-orange-500 focus:ring-orange-500 w-4 h-4 bg-zinc-900"
                          />
                          <span>Obrigatório</span>
                        </label>

                        {/* Delete Group */}
                        <button
                          type="button"
                          onClick={() => handleRemoveModifierGroup(group.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Excluir este grupo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Min / Max Quantities */}
                    <div className="grid grid-cols-2 gap-3 p-2.5 rounded-xl bg-[#090B0E] border border-zinc-850 text-xs">
                      <div>
                        <span className="text-[11px] text-zinc-400 block mb-1">
                          Quantidade Mínima
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={group.minQuantity}
                          onChange={e =>
                            handleUpdateGroup(group.id, {
                              minQuantity: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full h-8 px-2.5 bg-[#14171E] border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-zinc-400 block mb-1">
                          Quantidade Máxima
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={group.maxQuantity}
                          onChange={e =>
                            handleUpdateGroup(group.id, {
                              maxQuantity: parseInt(e.target.value, 10) || 1,
                            })
                          }
                          className="w-full h-8 px-2.5 bg-[#14171E] border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    {/* Group Options list */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                        Opções do Grupo ({group.options.length})
                      </span>

                      <div className="space-y-1.5">
                        {group.options.map(option => (
                          <div
                            key={option.id}
                            className="flex items-center gap-2 p-1.5 rounded-xl bg-[#0A0C0F] border border-zinc-800/80"
                          >
                            <input
                              type="text"
                              value={option.name}
                              onChange={e =>
                                handleUpdateOption(group.id, option.id, {
                                  name: e.target.value,
                                })
                              }
                              placeholder="Nome da opção (ex: Bacon crocante)"
                              className="flex-1 h-8 px-2.5 bg-transparent border-none text-xs text-white placeholder-zinc-600 focus:outline-none"
                            />

                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[11px] text-zinc-500 font-mono">+ R$</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={option.price}
                                onChange={e =>
                                  handleUpdateOption(group.id, option.id, {
                                    price: parseFloat(e.target.value) || 0,
                                  })
                                }
                                placeholder="0.00"
                                className="w-16 h-8 px-1.5 bg-[#14171E] border border-zinc-800 rounded-lg text-xs font-mono text-white text-right focus:outline-none focus:border-orange-500"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveOption(group.id, option.id)}
                              className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors shrink-0"
                              title="Remover opção"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddOptionToGroup(group.id)}
                        className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 font-medium py-1 px-2 rounded-lg hover:bg-orange-500/10 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar outra opção neste grupo</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};
