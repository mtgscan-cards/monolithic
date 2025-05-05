declare module 'three/examples/jsm/utils/SkeletonUtils' {
    import { AnimationClip, Bone, Object3D, Skeleton, Vector3 } from "three";
  
    export interface RetargetOptions {
      preserveBoneMatrix?: boolean;
      preserveHipPosition?: boolean;
      useTargetMatrix?: boolean;
      hip?: string;
      hipInfluence?: Vector3;
      scale?: number;
      names?: { [boneName: string]: string };
      getBoneName?: (bone: Bone) => string;
      hipPosition?: Vector3;
    }
  
    declare function retarget(
      target: Object3D | Skeleton, 
      source: Object3D | Skeleton, 
      options?: RetargetOptions
    ): void;
  
    export interface RetargetClipOptions extends RetargetOptions {
      useFirstFramePosition?: boolean;
      fps?: number;
      trim?: [number, number];
    }
  
    declare function retargetClip(
      target: Skeleton | Object3D,
      source: Skeleton | Object3D,
      clip: AnimationClip,
      options?: RetargetClipOptions,
    ): AnimationClip;
  
    declare function clone(source: Object3D): Object3D;
  
    export { clone, retarget, retargetClip };
  }
  